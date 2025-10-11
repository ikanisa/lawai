import OpenAI, { type ClientOptions } from 'openai';
export type OpenAIClientConfig = ClientOptions & {
    apiKey: string;
    /** Optional semantic identifier used for cache segregation */
    cacheKeySuffix?: string;
    /** Optional request tagging override */
    requestTags?: string;
};
export declare function getOpenAIClient(config: OpenAIClientConfig): OpenAI;
export declare function resetOpenAIClientCache(): void;
export declare function isOpenAIDebugEnabled(): boolean;
export type OpenAIDebugDetails = {
    requestId: string;
    details: unknown;
} | {
    requestId: string;
    debugError: unknown;
};
export declare function fetchOpenAIDebugDetails(client: OpenAI, error: unknown): Promise<OpenAIDebugDetails | null>;
//# sourceMappingURL=client.d.ts.map