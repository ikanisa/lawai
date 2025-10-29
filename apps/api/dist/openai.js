import { fetchOpenAIDebugDetails, getOpenAIClient, isOpenAIDebugEnabled, } from '@avocat-ai/shared';
import { env } from './config.js';
const defaultConfig = {
    apiKey: env.OPENAI_API_KEY,
    cacheKeySuffix: 'api-backend',
    requestTags: process.env.OPENAI_REQUEST_TAGS_API ?? process.env.OPENAI_REQUEST_TAGS ?? 'service=api,component=backend',
};
let openAIClientFactory = null;
let vectorStoreClientFactory = null;
export function setOpenAIClientFactory(factory) {
    openAIClientFactory = factory;
}
export function setVectorStoreClientFactory(factory) {
    vectorStoreClientFactory = factory;
}
export function getOpenAI() {
    if (openAIClientFactory) {
        return openAIClientFactory();
    }
    return getOpenAIClient(defaultConfig);
}
export function getVectorStoreClient() {
    if (vectorStoreClientFactory) {
        return vectorStoreClientFactory();
    }
    const client = getOpenAI();
    const vectorStore = client?.beta?.vectorStores;
    if (!vectorStore) {
        throw new Error('vector_store_client_unavailable');
    }
    return vectorStore;
}
let defaultLogger = null;
export function setOpenAILogger(logger) {
    defaultLogger = logger;
}
export async function logOpenAIDebug(operation, error, logger) {
    if (!isOpenAIDebugEnabled()) {
        return;
    }
    const client = getOpenAI();
    const info = await fetchOpenAIDebugDetails(client, error);
    if (!info) {
        return;
    }
    const payload = {
        openaiRequestId: info.requestId,
    };
    if ('details' in info) {
        payload.debug = info.details;
    }
    else if ('debugError' in info) {
        payload.debugError = info.debugError instanceof Error ? info.debugError.message : info.debugError;
    }
    const targetLogger = logger ?? defaultLogger;
    if (targetLogger?.error) {
        targetLogger.error(payload, `${operation}_openai_debug`);
    }
    else {
        console.error(`[openai-debug] ${operation}`, payload);
    }
}
export function resetOpenAIClientFactories() {
    openAIClientFactory = null;
    vectorStoreClientFactory = null;
}
