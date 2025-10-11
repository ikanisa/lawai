export interface OpenAIDenoClientConfig {
    apiKey: string;
    baseUrl?: string;
    organization?: string;
    project?: string;
    requestTags?: string;
}
export interface OpenAIDenoClient {
    files: {
        create(params: {
            purpose: 'assistants';
            data: Uint8Array | ArrayBuffer | Blob;
            filename: string;
            mimeType?: string;
        }): Promise<{
            id: string;
        }>;
    };
    beta: {
        vectorStores: {
            files: {
                create(vectorStoreId: string, body: {
                    file_id: string;
                }): Promise<void>;
            };
        };
    };
    debugging: {
        requests: {
            retrieve(requestId: string): Promise<unknown>;
        };
    };
}
export declare function createOpenAIDenoClient(config: OpenAIDenoClientConfig): OpenAIDenoClient;
export declare function fetchOpenAIDenoDebugDetails(client: OpenAIDenoClient, requestId: string): Promise<unknown>;
//# sourceMappingURL=deno.d.ts.map