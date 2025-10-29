import { SUMMARISATION_CLIENT_TAGS, fetchOpenAIDebugDetails, getOpenAIClient, isOpenAIDebugEnabled, legalDocumentSummaryTextFormat, } from '@avocat-ai/shared';
import { env } from './config.js';
const textDecoder = new TextDecoder('utf-8', { fatal: false });
const DEFAULT_SUMMARISER_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_SUMMARY_CHARS = 12000;
const MAX_CHUNKS = 40;
async function logOpenAIDebugSummary(client, operation, error, logger) {
    if (!isOpenAIDebugEnabled()) {
        return;
    }
    const info = await fetchOpenAIDebugDetails(client, error);
    if (!info) {
        return;
    }
    if (logger?.error) {
        logger.error({
            openaiRequestId: info.requestId,
            debug: 'details' in info ? info.details : undefined,
            debugError: 'debugError' in info ? info.debugError : undefined,
        }, `${operation}_openai_debug`);
    }
    else {
        console.error(`[openai-debug] ${operation}`, info);
    }
}
function extractStructuredOutputText(result) {
    const direct = typeof result?.output_text === 'string' ? result.output_text.trim() : '';
    if (direct) {
        return direct;
    }
    if (Array.isArray(result?.output)) {
        for (const item of result.output) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const content = Array.isArray(item.content) ? item.content : [];
            for (const part of content) {
                if (part && typeof part === 'object' && typeof part.text === 'string') {
                    const text = part.text.trim();
                    if (text) {
                        return text;
                    }
                }
            }
        }
    }
    const jsonPayload = result?.output_json;
    if (typeof jsonPayload === 'string' && jsonPayload.trim()) {
        return jsonPayload.trim();
    }
    if (jsonPayload && typeof jsonPayload === 'object') {
        try {
            const stringified = JSON.stringify(jsonPayload);
            if (stringified.trim()) {
                return stringified.trim();
            }
        }
        catch {
            // ignore serialization errors
        }
    }
    return '';
}
function stripHtml(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
}
function normaliseWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}
export function extractPlainText(payload, mimeType) {
    if (!payload || payload.byteLength === 0) {
        return '';
    }
    const raw = textDecoder.decode(payload);
    if (!raw) {
        return '';
    }
    if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
        return normaliseWhitespace(stripHtml(raw));
    }
    if (mimeType.includes('xml')) {
        return normaliseWhitespace(stripHtml(raw));
    }
    if (mimeType.startsWith('text/')) {
        return normaliseWhitespace(raw);
    }
    if (mimeType === 'application/pdf') {
        return '';
    }
    return normaliseWhitespace(raw);
}
function detectArticleLabel(text) {
    const articleMatch = text.match(/\b(?:article|art\.)\s*[0-9A-Za-z-]+/i);
    if (articleMatch) {
        return articleMatch[0];
    }
    const sectionMatch = text.match(/\b(?:section|chapitre|titre)\s*[0-9A-Za-z-]+/i);
    return sectionMatch ? sectionMatch[0] : null;
}
export function chunkText(content, chunkSize = 1200, overlap = 200) {
    const cleaned = normaliseWhitespace(content);
    if (!cleaned) {
        return [];
    }
    const chunks = [];
    let index = 0;
    let seq = 0;
    while (index < cleaned.length && chunks.length < MAX_CHUNKS) {
        let end = Math.min(index + chunkSize, cleaned.length);
        if (end < cleaned.length) {
            const lastPeriod = cleaned.lastIndexOf('. ', end);
            if (lastPeriod > index + chunkSize / 2) {
                end = lastPeriod + 1;
            }
        }
        const slice = cleaned.slice(index, end).trim();
        if (slice.length > 0) {
            chunks.push({ seq, content: slice, marker: detectArticleLabel(slice) });
            seq += 1;
        }
        if (end >= cleaned.length) {
            break;
        }
        const nextIndex = Math.max(end - overlap, 0);
        index = nextIndex > index ? nextIndex : end;
    }
    return chunks;
}
function findRefusalMessage(response) {
    for (const item of response.output ?? []) {
        if (item.type !== 'message') {
            continue;
        }
        for (const content of item.content ?? []) {
            if (content.type === 'refusal' && typeof content.refusal === 'string') {
                return content.refusal;
            }
        }
    }
    return null;
}
async function generateStructuredSummary(text, metadata, openaiApiKey, model, maxSummaryChars, logger) {
    const truncated = text.slice(0, maxSummaryChars);
    const openai = getOpenAIClient({ apiKey: openaiApiKey, ...SUMMARISATION_CLIENT_TAGS });
    let response;
    try {
        response = await openai.responses.parse({
            model,
            input: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'text',
                            text: "Tu es un assistant juridique senior. Résume les documents officiels en français, en rappelant les points clefs, la portée juridique et les dates importantes.",
                        },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Titre: ${metadata.title}\nJuridiction: ${metadata.jurisdiction}\nÉditeur: ${metadata.publisher ?? 'Inconnu'}\n\nTexte:\n${truncated}`,
                        },
                    ],
                },
            ],
            text: { format: legalDocumentSummaryTextFormat },
            max_output_tokens: 800,
        });
    }
    catch (error) {
        await logOpenAIDebugSummary(openai, 'structured_summary', error, logger);
        const message = error instanceof Error ? error.message : 'Synthèse indisponible';
        throw new Error(message);
    }
    const parsed = response.output_parsed;
    if (!parsed) {
        const refusal = findRefusalMessage(response);
        if (refusal) {
            throw new Error(refusal);
        }
        throw new Error('Synthèse JSON invalide');
    }
    const summary = parsed.summary.trim();
    const highlights = parsed.highlights
        .map((entry) => ({ heading: entry.heading.trim(), detail: entry.detail.trim() }))
        .filter((entry) => entry.heading.length > 0 && entry.detail.length > 0);
    if (!summary) {
        throw new Error('Synthèse JSON invalide');
    }
    return { summary, highlights };
}
async function generateEmbeddings(texts, openaiApiKey, model, dimensions, logger) {
    const embeddings = [];
    const batchSize = 16;
    const openai = getOpenAIClient({ apiKey: openaiApiKey, ...SUMMARISATION_CLIENT_TAGS });
    for (let index = 0; index < texts.length; index += batchSize) {
        const slice = texts.slice(index, index + batchSize);
        let response;
        try {
            response = await openai.embeddings.create({
                model,
                input: slice,
                ...(dimensions ? { dimensions } : {}),
            });
        }
        catch (error) {
            await logOpenAIDebugSummary(openai, 'document_embedding_batch', error, logger);
            const message = error instanceof Error ? error.message : 'Échec de génération des embeddings';
            throw new Error(message);
        }
        for (const entry of response.data ?? []) {
            if (Array.isArray(entry.embedding)) {
                embeddings.push(entry.embedding);
            }
        }
    }
    return embeddings;
}
export async function summariseDocumentFromPayload(params) {
    const { payload, mimeType, metadata, openaiApiKey, summariserModel, embeddingModel, maxSummaryChars, logger, } = params;
    if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY missing');
    }
    const plainText = extractPlainText(payload, mimeType);
    if (!plainText || plainText.length < 120) {
        return {
            status: 'skipped',
            chunks: [],
            embeddings: [],
            error: 'Texte exploitable indisponible',
        };
    }
    try {
        const summary = await generateStructuredSummary(plainText, metadata, openaiApiKey, summariserModel ?? env.SUMMARISER_MODEL ?? DEFAULT_SUMMARISER_MODEL, Math.min(maxSummaryChars ?? env.MAX_SUMMARY_CHARS ?? DEFAULT_MAX_SUMMARY_CHARS, DEFAULT_MAX_SUMMARY_CHARS), logger);
        const chunks = chunkText(plainText);
        const inputs = chunks.map((chunk) => chunk.content);
        const embeddings = inputs.length
            ? await generateEmbeddings(inputs, openaiApiKey, embeddingModel ?? env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSION, logger)
            : [];
        return {
            status: 'ready',
            summary: summary.summary,
            highlights: summary.highlights,
            chunks,
            embeddings,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Synthèse ou embeddings indisponibles';
        return {
            status: 'failed',
            chunks: [],
            embeddings: [],
            error: message,
        };
    }
}
