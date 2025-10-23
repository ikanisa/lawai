function getBetaNamespace(client) {
    return client.beta;
}
export function getVectorStoreApi(client) {
    const beta = getBetaNamespace(client);
    const vectorStores = beta?.vectorStores;
    if (!vectorStores) {
        throw new Error('Vector store API is not available on this OpenAI client');
    }
    return vectorStores;
}
export function tryGetVectorStoreApi(client) {
    try {
        return getVectorStoreApi(client);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Vector store API')) {
            return null;
        }
        throw error;
    }
}
