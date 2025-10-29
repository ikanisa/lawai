import type { WebSearchMode } from '@avocat-ai/shared';
export interface AgentRunResultLike {
    runId: string;
    payload: unknown;
    allowlistViolations: string[];
    toolLogs: Array<{
        name: string;
        args: unknown;
        output: unknown;
    }>;
    plan?: unknown[];
    reused?: boolean;
    notices?: unknown[];
    verification?: unknown;
    trustPanel?: unknown;
}
export declare function runLegalAgent(input: {
    question: string;
    context?: string;
    orgId: string;
    userId: string;
    confidentialMode?: boolean;
    webSearchMode?: WebSearchMode;
}, access: unknown): Promise<AgentRunResultLike>;
export declare function getHybridRetrievalContext(orgId: string, query: string, jurisdiction: string | null): Promise<Array<{
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
}>>;
//# sourceMappingURL=agent-wrapper.d.ts.map