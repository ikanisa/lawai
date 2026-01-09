/**
 * LawAI Orchestrator - Harvey AI-Inspired Multi-Agent System
 * 
 * Central AI orchestration with specialized agents:
 * - ResearchAgent: Legal research across multiple sources
 * - AnalysisAgent: Document analysis and extraction
 * - DraftingAgent: Document generation
 * - ReviewAgent: Document review and quality control
 * - WorkflowAgent: Custom workflow execution
 */

import OpenAI from 'openai';
import { prisma } from './db';

const getOpenAIApiKey = () => {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.SUPABASE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY_SECRET
  );
};

const openaiApiKey = getOpenAIApiKey();
const openai = new OpenAI({
  apiKey: openaiApiKey || 'dummy-key',
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

interface ExecutionPlan {
  steps: Array<{
    id: string;
    agent: 'research' | 'analysis' | 'drafting' | 'review' | 'workflow';
    description: string;
    dependencies?: string[];
  }>;
}

interface AgentResult {
  type: string;
  data: any;
  needsAdaptation?: boolean;
  requiresHumanReview?: boolean;
  confidence?: number;
}

/**
 * Main Orchestrator - Routes requests to appropriate agents
 */
export class LawAIOrchestrator {
  private userId: string;
  private organizationId: string;
  private matterId?: string;
  private caseId?: string;

  constructor(userId: string, organizationId: string, matterId?: string, caseId?: string) {
    this.userId = userId;
    this.organizationId = organizationId;
    this.matterId = matterId;
    this.caseId = caseId;
  }

  /**
   * Main entry point - processes requests with planning and adaptation
   */
  async processRequest(request: {
    type: 'chat' | 'research' | 'analysis' | 'draft' | 'review' | 'workflow';
    content: string;
    context?: Record<string, any>;
  }): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Plan: Determine which agent(s) to use
      const executionPlan = await this._createExecutionPlan(request);

      // Execute with adaptation
      const result = await this._executeWithAdaptation(executionPlan, request);

      // Log interaction
      const latencyMs = Date.now() - startTime;
      await this._logInteraction(request, result, latencyMs);

      return result;
    } catch (error) {
      await this._logError(request, error);
      throw error;
    }
  }

  /**
   * Create multi-step execution plan
   */
  private async _createExecutionPlan(request: any): Promise<ExecutionPlan> {
    const prompt = `Given this request: ${JSON.stringify(request)}
Create an execution plan with steps and assigned agents.
Available agents: research, analysis, drafting, review
Return JSON with structure: { "steps": [{"id": "step_1", "agent": "research", "description": "..."}] }`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const plan = JSON.parse(response.choices[0]?.message?.content || '{"steps":[]}');
      return plan as ExecutionPlan;
    } catch (error) {
      // Fallback to simple plan
      return {
        steps: [
          {
            id: 'step_1',
            agent: this._mapRequestTypeToAgent(request.type),
            description: `Execute ${request.type} request`,
          },
        ],
      };
    }
  }

  private _mapRequestTypeToAgent(
    type: string
  ): 'research' | 'analysis' | 'drafting' | 'review' | 'workflow' {
    const mapping: Record<string, 'research' | 'analysis' | 'drafting' | 'review' | 'workflow'> = {
      chat: 'research',
      research: 'research',
      analysis: 'analysis',
      draft: 'drafting',
      review: 'review',
      workflow: 'workflow',
    };
    return mapping[type] || 'research';
  }

  /**
   * Execute plan with dynamic adaptation
   */
  private async _executeWithAdaptation(
    plan: ExecutionPlan,
    request: any
  ): Promise<AgentResult> {
    const results: AgentResult[] = [];

    for (const step of plan.steps) {
      const agent = this._getAgent(step.agent);
      const stepResult = await agent.execute(step, request, results);

      results.push(stepResult);

      // Adapt: Check if plan needs modification
      if (stepResult.needsAdaptation) {
        plan = await this._adaptPlan(plan, stepResult);
      }

      // Interact: Check if human input needed
      if (stepResult.requiresHumanReview) {
        // In a real implementation, this would trigger a notification
        console.log('Human review required for step:', step.id);
      }
    }

    return this._consolidateResults(results);
  }

  private _getAgent(type: string): any {
    switch (type) {
      case 'research':
        return new ResearchAgent(this);
      case 'analysis':
        return new AnalysisAgent(this);
      case 'drafting':
        return new DraftingAgent(this);
      case 'review':
        return new ReviewAgent(this);
      case 'workflow':
        return new WorkflowAgent(this);
      default:
        return new ResearchAgent(this);
    }
  }

  private async _adaptPlan(plan: ExecutionPlan, result: AgentResult): Promise<ExecutionPlan> {
    // Simple adaptation - in production, this would use AI to modify the plan
    return plan;
  }

  private _consolidateResults(results: AgentResult[]): AgentResult {
    if (results.length === 1) {
      return results[0];
    }

    return {
      type: 'consolidated',
      data: {
        steps: results.map((r) => ({ type: r.type, data: r.data })),
        summary: 'Multi-step execution completed',
      },
      confidence: results.reduce((acc, r) => (acc + (r.confidence || 0)) / results.length, 0),
    };
  }

  private async _logInteraction(request: any, result: AgentResult, latencyMs: number) {
    try {
      // Estimate token counts (simplified)
      const tokensPrompt = Math.ceil(JSON.stringify(request).length / 4);
      const tokensCompletion = Math.ceil(JSON.stringify(result).length / 4);

      await prisma.aIInteraction.create({
        data: {
          organizationId: this.organizationId,
          userId: this.userId,
          matterId: this.matterId,
          caseId: this.caseId,
          interactionType: request.type,
          agentType: result.type,
          prompt: typeof request.content === 'string' ? request.content : JSON.stringify(request.content),
          context: request.context || {},
          modelUsed: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          knowledgeSources: [],
          response: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          citations: [],
          confidenceScore: result.confidence || null,
          tokensPrompt,
          tokensCompletion,
          latencyMs,
        },
      });
    } catch (error) {
      console.error('Failed to log AI interaction:', error);
    }
  }

  private async _logError(request: any, error: any) {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: this.organizationId,
          userId: this.userId,
          action: 'AI_INTERACTION_ERROR',
          resourceType: 'ai',
          metadata: {
            request,
            error: String(error),
          },
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

/**
 * Research Agent - Legal research across multiple sources
 */
class ResearchAgent {
  constructor(private orchestrator: LawAIOrchestrator) {}

  async execute(step: any, request: any, previousResults: AgentResult[]): Promise<AgentResult> {
    const query = step.description || request.content;

    // Search internal vault if matter is available
    let vaultResults: any[] = [];
    if (this.orchestrator['matterId']) {
      vaultResults = await this._searchVault(query);
    }

    // Perform AI research
    const researchResult = await this._performResearch(query, vaultResults);

    return {
      type: 'research',
      data: {
        query,
        findings: researchResult.findings,
        citations: researchResult.citations,
        vaultResults: vaultResults.length,
      },
      confidence: researchResult.confidence,
    };
  }

  private async _searchVault(query: string): Promise<any[]> {
    try {
      // Semantic search in vault documents
      const documents = await prisma.document.findMany({
        where: {
          vault: {
            matterId: this.orchestrator['matterId'],
          },
          extractionStatus: 'completed',
        },
        take: 10,
        orderBy: {
          uploadedAt: 'desc',
        },
      });

      // Simple keyword matching (in production, use vector similarity)
      return documents
        .filter((doc) => {
          const text = doc.extractedText || '';
          return text.toLowerCase().includes(query.toLowerCase());
        })
        .map((doc) => ({
          title: doc.title,
          content: doc.extractedText?.substring(0, 500),
          relevance: 0.8, // Simplified
        }));
    } catch (error) {
      console.error('Vault search error:', error);
      return [];
    }
  }

  private async _performResearch(query: string, vaultResults: any[]): Promise<any> {
    const context = vaultResults.length > 0
      ? `\n\nRelevant documents from vault:\n${vaultResults.map((r) => `- ${r.title}: ${r.content}`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nEffectue une recherche juridique approfondie. Cite tes sources.`,
        },
        {
          role: 'user',
          content: `Question: ${query}${context}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';

    return {
      findings: content,
      citations: this._extractCitations(content),
      confidence: 0.85,
    };
  }

  private _extractCitations(text: string): any[] {
    // Simple citation extraction (in production, use more sophisticated parsing)
    const citationPattern = /\[([^\]]+)\]/g;
    const citations: any[] = [];
    let match;

    while ((match = citationPattern.exec(text)) !== null) {
      citations.push({ source: match[1] });
    }

    return citations;
  }
}

/**
 * Analysis Agent - Document analysis and extraction
 */
class AnalysisAgent {
  constructor(private orchestrator: LawAIOrchestrator) {}

  async execute(step: any, request: any, previousResults: AgentResult[]): Promise<AgentResult> {
    const documentId = request.context?.documentId;
    if (!documentId) {
      throw new Error('Document ID required for analysis');
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const analysis = await this._analyzeDocument(document);

    return {
      type: 'analysis',
      data: analysis,
      confidence: 0.9,
    };
  }

  private async _analyzeDocument(document: any): Promise<any> {
    const text = document.extractedText || document.aiAnalysis || '';

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nAnalyse ce document juridique et extraire:
1. Points clés
2. Risques identifiés
3. Recommandations
4. Références légales
5. Parties impliquées
6. Dates importantes`,
        },
        {
          role: 'user',
          content: `Document: ${document.title}\n\n${text.substring(0, 10000)}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const analysis = response.choices[0]?.message?.content || '';

    // Update document with analysis
    await prisma.document.update({
      where: { id: document.id },
      data: {
        aiSummary: analysis,
        aiMetadata: {
          analyzedAt: new Date().toISOString(),
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        },
      },
    });

    return {
      summary: analysis,
      keyPoints: [],
      risks: [],
      recommendations: [],
    };
  }
}

/**
 * Drafting Agent - Document generation
 */
class DraftingAgent {
  constructor(private orchestrator: LawAIOrchestrator) {}

  async execute(step: any, request: any, previousResults: AgentResult[]): Promise<AgentResult> {
    const templateId = request.context?.templateId;
    const variables = request.context?.variables || {};

    if (templateId) {
      return await this._draftFromTemplate(templateId, variables);
    }

    return await this._draftFromScratch(request.content, variables);
  }

  private async _draftFromTemplate(templateId: string, variables: any): Promise<AgentResult> {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nGénère un document professionnel basé sur ce modèle.`,
        },
        {
          role: 'user',
          content: `Modèle: ${template.content}\n\nVariables: ${JSON.stringify(variables)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return {
      type: 'drafting',
      data: {
        content: response.choices[0]?.message?.content || '',
        templateId,
      },
      confidence: 0.85,
    };
  }

  private async _draftFromScratch(instruction: string, variables: any): Promise<AgentResult> {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nGénère un document juridique professionnel.`,
        },
        {
          role: 'user',
          content: `Instructions: ${instruction}\n\nVariables: ${JSON.stringify(variables)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return {
      type: 'drafting',
      data: {
        content: response.choices[0]?.message?.content || '',
      },
      confidence: 0.8,
    };
  }
}

/**
 * Review Agent - Document review and quality control
 */
class ReviewAgent {
  constructor(private orchestrator: LawAIOrchestrator) {}

  async execute(step: any, request: any, previousResults: AgentResult[]): Promise<AgentResult> {
    const documentId = request.context?.documentId;
    const content = request.content;

    const review = await this._reviewDocument(content);

    if (documentId) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          reviewStatus: 'completed',
          reviewedById: this.orchestrator['userId'],
          annotations: review.issues,
        },
      });
    }

    return {
      type: 'review',
      data: review,
      requiresHumanReview: review.issues.length > 0,
      confidence: 0.9,
    };
  }

  private async _reviewDocument(content: string): Promise<any> {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nRévise ce document et identifie:
1. Erreurs juridiques
2. Incohérences
3. Points à clarifier
4. Améliorations suggérées`,
        },
        {
          role: 'user',
          content: `Document à réviser:\n\n${content.substring(0, 10000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const review = response.choices[0]?.message?.content || '';

    return {
      summary: review,
      issues: [],
      recommendations: [],
    };
  }
}

/**
 * Workflow Agent - Custom workflow execution
 */
class WorkflowAgent {
  constructor(private orchestrator: LawAIOrchestrator) {}

  async execute(step: any, request: any, previousResults: AgentResult[]): Promise<AgentResult> {
    const workflowId = request.context?.workflowId;
    if (!workflowId) {
      throw new Error('Workflow ID required');
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        matterId: this.orchestrator['matterId'],
        triggeredById: this.orchestrator['userId'],
        status: 'RUNNING',
        inputData: request.context || {},
        currentStep: 0,
      },
    });

    try {
      // Execute workflow steps
      const steps = workflow.steps as any[];
      const results: any[] = [];

      for (let i = 0; i < steps.length; i++) {
        const stepResult = await this._executeStep(steps[i], request, results);
        results.push(stepResult);

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            currentStep: i + 1,
          },
        });
      }

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          outputData: results,
          completedAt: new Date(),
          executionTimeMs: Date.now() - execution.startedAt.getTime(),
        },
      });

      return {
        type: 'workflow',
        data: {
          executionId: execution.id,
          results,
        },
        confidence: 0.9,
      };
    } catch (error) {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: String(error),
        },
      });
      throw error;
    }
  }

  private async _executeStep(step: any, request: any, previousResults: any[]): Promise<any> {
    // Execute workflow step based on type
    switch (step.type) {
      case 'prompt':
        return await this._executePromptStep(step, request);
      case 'analysis':
        return await this._executeAnalysisStep(step, request);
      default:
        return { step: step.id, result: 'completed' };
    }
  }

  private async _executePromptStep(step: any, request: any): Promise<any> {
    const response = await openai.chat.completions.create({
      model: step.model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: step.promptTemplate || request.content,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return {
      step: step.id,
      result: response.choices[0]?.message?.content || '',
    };
  }

  private async _executeAnalysisStep(step: any, request: any): Promise<any> {
    // Similar to AnalysisAgent
    return { step: step.id, result: 'analysis completed' };
  }
}

/**
 * Legacy compatibility - wraps orchestrator for existing code
 */
export async function queryLegalAgent(
  messages: { role: string; content: string }[],
  userId: string,
  organizationId: string,
  sessionId?: string,
  matterId?: string
): Promise<string> {
  const orchestrator = new LawAIOrchestrator(userId, organizationId, matterId);
  const lastMessage = messages[messages.length - 1];

  const result = await orchestrator.processRequest({
    type: 'chat',
    content: lastMessage.content,
    context: {
      previousMessages: messages.slice(0, -1),
    },
  });

  return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
}
