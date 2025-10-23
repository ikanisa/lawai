import type { z } from 'zod';
import { IRACPayloadSchema } from './schemas/irac.js';
import { ToolInvocationLogsSchema } from './schemas/tools.js';

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
    userLocationOverride?: string | null;
  },
  access: unknown,
): Promise<AgentRunResultLike> {
  // Use dynamic import via Function to avoid pulling agent.ts into the typecheck program
  const importer = new Function('p', 'return import(p)');
  const mod = (await (importer as any)('./agent.js')) as { runLegalAgent: Function };
  const rawRun = mod.runLegalAgent;
  const result = (await rawRun(input, access)) as AgentRunResultLike;
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
