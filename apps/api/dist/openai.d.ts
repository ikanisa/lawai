import { getOpenAIClient } from '@avocat-ai/shared';
type OpenAIClient = ReturnType<typeof getOpenAIClient>;
type VectorStoreClient = {
    query: (input: Record<string, unknown>) => Promise<any>;
};
export declare function setOpenAIClientFactory(factory: (() => OpenAIClient) | null): void;
export declare function setVectorStoreClientFactory(factory: (() => VectorStoreClient) | null): void;
export declare function getOpenAI(): unknown;
export declare function getVectorStoreClient(): VectorStoreClient;
type Logger = {
    error: (data: Record<string, unknown>, message: string) => void;
    warn?: (data: Record<string, unknown>, message: string) => void;
};
export declare function setOpenAILogger(logger: Logger): void;
export declare function logOpenAIDebug(operation: string, error: unknown, logger?: Logger): Promise<void>;
export declare function resetOpenAIClientFactories(): void;
export {};
//# sourceMappingURL=openai.d.ts.map