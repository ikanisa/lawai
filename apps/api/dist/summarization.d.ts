export type TextChunk = {
    seq: number;
    content: string;
    marker: string | null;
};
type SummarisationLogger = {
    error: (data: Record<string, unknown>, message: string) => void;
    warn?: (data: Record<string, unknown>, message: string) => void;
};
export declare function extractPlainText(payload: Uint8Array, mimeType: string): string;
export declare function chunkText(content: string, chunkSize?: number, overlap?: number): TextChunk[];
export interface SummarisationMetadata {
    title: string;
    jurisdiction: string;
    publisher: string | null;
}
export interface SummarisationResult {
    status: 'ready' | 'skipped' | 'failed';
    summary?: string;
    highlights?: Array<{
        heading: string;
        detail: string;
    }>;
    chunks: TextChunk[];
    embeddings: number[][];
    error?: string;
}
export declare function summariseDocumentFromPayload(params: {
    payload: Uint8Array;
    mimeType: string;
    metadata: SummarisationMetadata;
    openaiApiKey: string;
    summariserModel?: string;
    embeddingModel?: string;
    maxSummaryChars?: number;
    logger?: SummarisationLogger;
}): Promise<SummarisationResult>;
export {};
//# sourceMappingURL=summarization.d.ts.map