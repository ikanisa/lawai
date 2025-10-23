import type OpenAI from 'openai';
export interface VectorStoreFileParams {
    file_id: string;
}
export interface VectorStoreApi {
    retrieve(id: string): Promise<{
        id: string;
    }>;
    create(params: {
        name: string;
    }): Promise<{
        id: string;
    }>;
    files: {
        create(vectorStoreId: string, params: VectorStoreFileParams): Promise<unknown>;
    };
}
export declare function getVectorStoreApi(client: OpenAI): VectorStoreApi;
export declare function tryGetVectorStoreApi(client: OpenAI): VectorStoreApi | null;
//# sourceMappingURL=vector-stores.d.ts.map