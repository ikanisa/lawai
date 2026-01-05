#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { diffWordsWithSpace } from 'diff';
import { z } from 'zod';

const server = new McpServer({
  name: 'lawai-mcp',
  version: '0.1.0',
});

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function extractObligations(text: string, locale?: string): string[] {
  const normalizedLocale = locale?.toLowerCase();
  const keywords = new Set<string>([
    'doit',
    'doivent',
    'obligatoire',
    'obligation',
    's engage',
    'est tenu',
    'est tenue',
    'must',
    'shall',
    'required',
  ]);

  if (normalizedLocale === 'en') {
    keywords.delete('doit');
    keywords.delete('doivent');
    keywords.delete('obligatoire');
    keywords.delete('obligation');
    keywords.delete('s engage');
    keywords.delete('est tenu');
    keywords.delete('est tenue');
  }

  const matches = new Set<string>();
  for (const sentence of splitSentences(text)) {
    const normalized = normalizeText(sentence).replace(/'/g, ' ');
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        matches.add(sentence);
        break;
      }
    }
  }

  return Array.from(matches);
}

function buildToolResponse<T extends Record<string, unknown>>(structuredContent: T) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

server.registerTool(
  'summarize',
  {
    description: 'Summarize legal text into a short paragraph.',
    inputSchema: {
      text: z.string().min(1),
      max_sentences: z.number().int().min(1).max(10).optional(),
    },
    outputSchema: {
      summary: z.string(),
      sentence_count: z.number(),
    },
  },
  async ({ text, max_sentences }) => {
    const sentences = splitSentences(text);
    const limit = max_sentences ?? 3;
    const summarySentences = sentences.slice(0, limit);
    const summary = summarySentences.join(' ');
    return buildToolResponse({
      summary,
      sentence_count: summarySentences.length,
    });
  },
);

server.registerTool(
  'compare_versions',
  {
    description: 'Compare two contract versions and return an inline diff summary.',
    inputSchema: {
      original: z.string().min(1),
      revised: z.string().min(1),
    },
    outputSchema: {
      diff: z.string(),
      added_count: z.number(),
      removed_count: z.number(),
    },
  },
  async ({ original, revised }) => {
    const changes = diffWordsWithSpace(original, revised);
    const added_count = changes
      .filter((part) => part.added)
      .reduce((sum, part) => sum + part.value.trim().split(/\s+/).filter(Boolean).length, 0);
    const removed_count = changes
      .filter((part) => part.removed)
      .reduce((sum, part) => sum + part.value.trim().split(/\s+/).filter(Boolean).length, 0);

    const diff = changes
      .map((part) => {
        if (part.added) return `[[+${part.value}+]]`;
        if (part.removed) return `[[-${part.value}-]]`;
        return part.value;
      })
      .join('');

    return buildToolResponse({
      diff,
      added_count,
      removed_count,
    });
  },
);

server.registerTool(
  'extract_obligations',
  {
    description: 'Extract obligations and action items from a clause or contract.',
    inputSchema: {
      text: z.string().min(1),
      locale: z.string().optional(),
    },
    outputSchema: {
      obligations: z.array(z.string()),
    },
  },
  async ({ text, locale }) => {
    const obligations = extractObligations(text, locale);
    return buildToolResponse({ obligations });
  },
);

server.registerTool(
  'analyze_clause',
  {
    description: 'Analyze a clause for risk signals and extracted obligations.',
    inputSchema: {
      clause_text: z.string().min(1),
      jurisdiction: z.string().optional(),
      locale: z.string().optional(),
    },
    outputSchema: {
      risk_level: z.enum(['low', 'medium', 'high']),
      summary: z.string(),
      highlights: z.array(z.string()),
      obligations: z.array(z.string()),
      signals: z.array(z.string()),
    },
  },
  async ({ clause_text, jurisdiction, locale }) => {
    const normalized = normalizeText(clause_text);
    const highSignals = [
      'non-concurrence',
      'noncompete',
      'penalite',
      'penalty',
      'responsabil',
      'liability',
      'indemn',
      'exclusion',
      'limitation',
      'resiliation',
      'termination',
      'arbitrage',
      'juridiction',
      'jurisdiction',
    ];
    const mediumSignals = [
      'confidential',
      'confidentialite',
      'force majeure',
      'paiement',
      'payment',
      'obligation',
      'doit',
      'shall',
      'must',
    ];

    const signals: string[] = [];
    for (const signal of highSignals) {
      if (normalized.includes(signal)) signals.push(signal);
    }
    for (const signal of mediumSignals) {
      if (normalized.includes(signal) && !signals.includes(signal)) signals.push(signal);
    }

    let risk_level: 'low' | 'medium' | 'high' = 'low';
    if (signals.some((signal) => highSignals.includes(signal))) {
      risk_level = 'high';
    } else if (signals.length > 0) {
      risk_level = 'medium';
    }

    const obligations = extractObligations(clause_text, locale);
    const highlights = splitSentences(clause_text)
      .filter((sentence) =>
        signals.some((signal) => normalizeText(sentence).includes(signal)) ||
        obligations.some((obligation) => sentence === obligation),
      )
      .slice(0, 3);

    const summaryParts = [
      `Risk level: ${risk_level}.`,
      `Signals: ${signals.length > 0 ? signals.join(', ') : 'none detected'}.`,
    ];
    if (jurisdiction) {
      summaryParts.push(`Jurisdiction: ${jurisdiction}.`);
    }
    const summary = summaryParts.join(' ');

    return buildToolResponse({
      risk_level,
      summary,
      highlights,
      obligations,
      signals,
    });
  },
);

server.registerTool(
  'draft_contract',
  {
    description: 'Generate a contract skeleton with placeholders based on a prompt.',
    inputSchema: {
      prompt: z.string().min(1),
      contract_type: z.string().optional(),
      jurisdiction: z.string().optional(),
      language: z.string().optional(),
      parties: z.array(z.string()).optional(),
    },
    outputSchema: {
      title: z.string(),
      language: z.string(),
      jurisdiction: z.string().optional(),
      sections: z.array(z.object({ heading: z.string(), body: z.string() })),
      draft: z.string(),
    },
  },
  async ({ prompt, contract_type, jurisdiction, language, parties }) => {
    const normalizedLanguage = language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
    const typeLabel = contract_type ?? (normalizedLanguage === 'en' ? 'Contract' : 'Contrat');
    const title = jurisdiction ? `${typeLabel} - ${jurisdiction}` : typeLabel;
    const partyLine = parties && parties.length > 0 ? parties.join(' / ') : '[Parties]';

    const sections = normalizedLanguage === 'en'
      ? [
          { heading: 'Parties', body: partyLine },
          { heading: 'Purpose', body: prompt },
          { heading: 'Definitions', body: '[Define key terms]' },
          { heading: 'Obligations', body: '[List core obligations]' },
          { heading: 'Term', body: '[Start date, duration, renewal]' },
          { heading: 'Termination', body: '[Termination triggers and notice]' },
          { heading: 'Confidentiality', body: '[Confidentiality obligations]' },
          { heading: 'Liability', body: '[Liability cap and exclusions]' },
          { heading: 'Governing law', body: jurisdiction ?? '[Governing law]' },
          { heading: 'Signatures', body: '[Signature blocks]' },
        ]
      : [
          { heading: 'Parties', body: partyLine },
          { heading: 'Objet', body: prompt },
          { heading: 'Definitions', body: '[Definir les termes clefs]' },
          { heading: 'Obligations', body: '[Lister les obligations principales]' },
          { heading: 'Duree', body: '[Date de debut, duree, renouvellement]' },
          { heading: 'Resiliation', body: '[Motifs de resiliation et preavis]' },
          { heading: 'Confidentialite', body: '[Obligations de confidentialite]' },
          { heading: 'Responsabilite', body: '[Plafond et exclusions]' },
          { heading: 'Droit applicable', body: jurisdiction ?? '[Droit applicable]' },
          { heading: 'Signatures', body: '[Blocs de signature]' },
        ];

    const draft = sections
      .map((section) => `${section.heading}\n${section.body}`)
      .join('\n\n');

    return buildToolResponse({
      title,
      language: normalizedLanguage,
      jurisdiction,
      sections,
      draft,
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LawAI MCP server running on stdio');
}

main().catch((error) => {
  console.error('LawAI MCP server error:', error);
  process.exit(1);
});
