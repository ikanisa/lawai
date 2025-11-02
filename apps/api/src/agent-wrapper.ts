import type { z } from 'zod';
import type { WebSearchMode } from '@avocat-ai/shared';
import { IRACPayloadSchema } from './schemas/irac.js';
import { ToolInvocationLogsSchema } from './schemas/tools.js';

// Prompt injection detection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all|prior)\s+instructions?/i,
  /disregard\s+(previous|above|all|prior)\s+instructions?/i,
  /forget\s+(previous|above|all|prior)\s+instructions?/i,
  /new\s+role:/i,
  /you\s+are\s+now/i,
  /system[:\s]/i,
  /\[\/INST\]/i, // Llama-style injection
  /```\s*system/i, // Markdown code block injection
  /<\|im_start\|>\s*system/i, // ChatML injection
  /reveal\s+(your|the)\s+(instructions|prompt|system)/i,
  /output\s+(your|the)\s+(instructions|prompt|system)/i,
  /show\s+(your|the)\s+(instructions|prompt|system)/i,
];

/**
 * Detects potential prompt injection attempts in user input
 * @returns Error message if injection detected, null otherwise
 */
function detectInjectionAttempt(input: string): string | null {
  const normalized = input.toLowerCase();
  
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return `Potential prompt injection detected: pattern "${pattern.source}"`;
    }
  }
  
  return null;
}

/**
 * Sanitizes user input to remove potentially malicious content
 * while preserving legitimate legal queries
 */
function sanitizeUserInput(input: string): string {
  let sanitized = input;
  
  // Strip markdown code blocks (common injection vector)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code block removed for security]');
  
  // Strip potential system-level instructions
  sanitized = sanitized.replace(/\n\s*system[:\s]/gi, '\n[redacted]');
  sanitized = sanitized.replace(/<\|im_start\|>\s*system/gi, '[redacted]');
  
  // Truncate to maximum safe length (10,000 chars)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '... [input truncated for security]';
  }
  
  return sanitized;
}

// Shape returned by the underlying agent; keep in sync with server expectations
export interface AgentRunResultLike {
  runId: string;
  payload: unknown;
  allowlistViolations: string[];
  toolLogs: Array<{ name: string; args: unknown; output: unknown }>;
  plan?: unknown[];
  reused?: boolean;
  notices?: unknown[];
  verification?: unknown;
  trustPanel?: unknown;
}

export async function runLegalAgent(
  input: {
    question: string;
    context?: string;
    orgId: string;
    userId: string;
    confidentialMode?: boolean;
    webSearchMode?: WebSearchMode;
  },
  access: unknown,
): Promise<AgentRunResultLike> {
  // Security: Detect prompt injection attempts
  const injectionDetected = detectInjectionAttempt(input.question);
  if (injectionDetected) {
    console.warn('Prompt injection attempt detected', {
      orgId: input.orgId,
      userId: input.userId,
      reason: injectionDetected,
    });
    
    // TODO: Log to audit_events table for security monitoring
    // For now, throw error to reject the request
    throw new Error('Requête rejetée pour des raisons de sécurité. / Request rejected for security reasons.');
  }
  
  // Security: Sanitize user inputs
  const sanitizedInput = {
    ...input,
    question: sanitizeUserInput(input.question),
    context: input.context ? sanitizeUserInput(input.context) : undefined,
  };
  
  // Use dynamic import via Function to avoid pulling agent.ts into the typecheck program
  const importer = new Function('p', 'return import(p)');
  const mod = (await (importer as any)('./agent.js')) as { runLegalAgent: Function };
  const rawRun = mod.runLegalAgent;
  const result = (await rawRun(sanitizedInput, access)) as AgentRunResultLike;
  const validated = IRACPayloadSchema.safeParse(result.payload);
  if (validated.success) {
    // Assign the parsed IRAC payload back for stronger shape at boundaries
    (result as AgentRunResultLike).payload = validated.data as z.infer<typeof IRACPayloadSchema> as unknown;
  }
  // Normalise tool logs shape defensively
  const toolsParsed = ToolInvocationLogsSchema.safeParse(result.toolLogs ?? []);
  if (toolsParsed.success) {
    (result as AgentRunResultLike).toolLogs = toolsParsed.data as unknown as AgentRunResultLike['toolLogs'];
  } else {
    (result as AgentRunResultLike).toolLogs = [];
  }
  return result;
}

export async function getHybridRetrievalContext(
  orgId: string,
  query: string,
  jurisdiction: string | null,
): Promise<Array<{
  content: string;
  similarity: number;
  weight: number;
  origin: 'local' | 'file_search';
  sourceId?: string | null;
  documentId?: string | null;
  fileId?: string | null;
  url?: string | null;
  title?: string | null;
  publisher?: string | null;
  trustTier?: string | null;
}>> {
  const importer = new Function('p', 'return import(p)');
  const mod = (await (importer as any)('./agent.js')) as { getHybridRetrievalContext: Function };
  return (mod.getHybridRetrievalContext as any)(orgId, query, jurisdiction);
}
