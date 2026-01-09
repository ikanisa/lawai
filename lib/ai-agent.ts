import OpenAI from 'openai';
import { prisma } from './db';

// Get OpenAI API key from Supabase secrets or environment
// Supabase stores secrets that can be accessed via environment variables
const getOpenAIApiKey = () => {
  // Try Supabase secrets first (if using Supabase Edge Functions or secrets)
  // Otherwise fall back to environment variable
  return (
    process.env.OPENAI_API_KEY ||
    process.env.SUPABASE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY_SECRET
  );
};

const openaiApiKey = getOpenAIApiKey();

if (!openaiApiKey) {
  console.warn(
    '⚠️  OpenAI API key not found. Please configure it in Supabase secrets or .env file'
  );
}

const openai = new OpenAI({
  apiKey: openaiApiKey || 'dummy-key', // Will fail gracefully if not set
});

const SYSTEM_PROMPT = `Tu es Avocat-AI, un assistant juridique autonome francophone avec plus de trente ans d'expérience en droit des affaires, contentieux civil et commercial, conformité et droit international privé.

Tu fonctionnes en priorité en français, mais peux répondre en anglais sur demande. Tes réponses suivent la structure IRAC (Issue, Rules, Application, Conclusion), citent exclusivement des sources officielles, précisent la valeur normative (contraignante ou informative) et indiquent les dates d'entrée en vigueur.

Juridictions couvertes:
- France (FR) avec overlay UE
- Canada - Québec (CA-QC)
- Belgique (BE) avec overlay UE
- Luxembourg (LU) avec overlay UE
- Suisse (cantons francophones) (CH)
- Monaco (MC)
- OHADA (17 États membres)
- Maghreb (Maroc, Tunisie, Algérie)

Principes:
- Respect de la compétence et des obligations déontologiques des avocats
- Vérification systématique des sources primaires
- Confidentialité des données clients
- Avertissement sur l'utilisation d'une traduction non contraignante

Si tu ne peux pas fournir une réponse fiable avec des sources vérifiables, indique clairement les limites et recommande une consultation avec un avocat qualifié.`;

/**
 * Centralized AI Agent for all legal operations
 * Handles: chat, document analysis, case research, summarization
 */
export class LawAIAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Interactive chat for legal assistance
   */
  async chat(
    messages: { role: string; content: string }[],
    sessionId?: string,
    caseContext?: string
  ): Promise<string> {
    await logAuditEvent({
      userId: this.userId,
      action: 'AI_CHAT',
      resourceType: 'chat',
      resourceId: sessionId,
      metadata: { messageCount: messages.length },
    });

    const contextPrompt = caseContext
      ? `\n\nContexte du dossier: ${caseContext}`
      : '';

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Supabase secrets or environment variables.');
    }

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT + contextPrompt,
          },
          ...messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';

      await logAuditEvent({
        userId: this.userId,
        action: 'AI_CHAT_SUCCESS',
        resourceType: 'chat',
        resourceId: sessionId,
        metadata: { responseLength: content.length },
      });

      return content;
    } catch (error) {
      await logAuditEvent({
        userId: this.userId,
        action: 'AI_CHAT_ERROR',
        resourceType: 'chat',
        resourceId: sessionId,
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Analyze legal document and extract insights
   */
  async analyzeDocument(documentContent: string, filename: string): Promise<any> {
    await logAuditEvent({
      userId: this.userId,
      action: 'AI_ANALYZE_DOCUMENT',
      resourceType: 'document',
      metadata: { filename },
    });

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Supabase secrets or environment variables.');
    }

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\nTu dois analyser ce document juridique et extraire:\n- Points clés\n- Risques identifiés\n- Recommandations\n- Références légales`,
          },
          {
            role: 'user',
            content: `Analyse ce document: ${filename}\n\n${documentContent.substring(0, 10000)}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const analysis = response.choices[0]?.message?.content || '';

      await logAuditEvent({
        userId: this.userId,
        action: 'AI_ANALYZE_DOCUMENT_SUCCESS',
        resourceType: 'document',
        metadata: { filename, analysisLength: analysis.length },
      });

      return {
        summary: analysis,
        keyPoints: [],
        risks: [],
        recommendations: [],
      };
    } catch (error) {
      await logAuditEvent({
        userId: this.userId,
        action: 'AI_ANALYZE_DOCUMENT_ERROR',
        resourceType: 'document',
        metadata: { filename, error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Perform legal research for a case
   */
  async researchCase(query: string, caseContext?: string): Promise<string> {
    await logAuditEvent({
      userId: this.userId,
      action: 'AI_RESEARCH_CASE',
      resourceType: 'case',
      metadata: { query },
    });

    const contextPrompt = caseContext
      ? `\n\nContexte du dossier: ${caseContext}`
      : '';

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Supabase secrets or environment variables.');
    }

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}${contextPrompt}\n\nEffectue une recherche juridique approfondie sur cette question.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const research = response.choices[0]?.message?.content || '';

      await logAuditEvent({
        userId: this.userId,
        action: 'AI_RESEARCH_CASE_SUCCESS',
        resourceType: 'case',
        metadata: { query, responseLength: research.length },
      });

      return research;
    } catch (error) {
      await logAuditEvent({
        userId: this.userId,
        action: 'AI_RESEARCH_CASE_ERROR',
        resourceType: 'case',
        metadata: { query, error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Generate case summary
   */
  async generateCaseSummary(caseTitle: string, caseDescription: string): Promise<string> {
    await logAuditEvent({
      userId: this.userId,
      action: 'AI_GENERATE_SUMMARY',
      resourceType: 'case',
    });

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Supabase secrets or environment variables.');
    }

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\nGénère un résumé exécutif concis de ce dossier juridique.`,
          },
          {
            role: 'user',
            content: `Titre: ${caseTitle}\n\nDescription: ${caseDescription}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      await logAuditEvent({
        userId: this.userId,
        action: 'AI_GENERATE_SUMMARY_ERROR',
        resourceType: 'case',
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Suggest next actions based on case analysis
   */
  async suggestActions(caseTitle: string, caseDescription: string): Promise<string[]> {
    await logAuditEvent({
      userId: this.userId,
      action: 'AI_SUGGEST_ACTIONS',
      resourceType: 'case',
    });

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Supabase secrets or environment variables.');
    }

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\nSuggère 3-5 actions concrètes à entreprendre pour ce dossier. Réponds uniquement avec une liste numérotée.`,
          },
          {
            role: 'user',
            content: `Titre: ${caseTitle}\n\nDescription: ${caseDescription}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const suggestions = response.choices[0]?.message?.content || '';
      return suggestions
        .split('\n')
        .filter((line) => line.trim().match(/^\d+[\.\)]/))
        .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim());
    } catch (error) {
      await logAuditEvent({
        userId: this.userId,
        action: 'AI_SUGGEST_ACTIONS_ERROR',
        resourceType: 'case',
        metadata: { error: String(error) },
      });
      return [];
    }
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function queryLegalAgent(
  messages: { role: string; content: string }[],
  userId: string,
  sessionId?: string
): Promise<string> {
  const agent = new LawAIAgent(userId);
  return agent.chat(messages, sessionId);
}

async function logAuditEvent(data: {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata || {},
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
