import { OFFICIAL_DOMAIN_REGISTRY } from '@avocat-ai/shared';
import { incrementCounter } from '../observability/metrics.js';
const JURISDICTION_PRIORITY = [
    'FR',
    'BE',
    'LU',
    'CH',
    'CA-QC',
    'CA',
    'MC',
    'EU',
    'OHADA',
    'OAPI',
    'CIMA',
    'MA',
    'TN',
    'DZ',
    'RW',
];
const JURISDICTION_WEIGHTS = new Map(JURISDICTION_PRIORITY.map((code, index) => [code, JURISDICTION_PRIORITY.length - index]));
const DEFAULT_CHUNK_SIZE = 20;
function normaliseDomain(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }
    let value = input.trim();
    if (!value) {
        return null;
    }
    if (value.includes('://')) {
        try {
            value = new URL(value).hostname;
        }
        catch (_error) {
            // Ignore malformed URLs and fall back to manual parsing
        }
    }
    if (value.includes('/')) {
        value = value.split('/')[0] ?? value;
    }
    value = value.replace(/^\*\./, '');
    value = value.replace(/\.$/, '');
    value = value.toLowerCase();
    return value.length > 0 ? value : null;
}
function lookupJurisdictions(domain, registry) {
    const normalized = domain.toLowerCase();
    const direct = registry[normalized];
    if (direct) {
        return [...direct];
    }
    for (const [allowed, jurisdictions] of Object.entries(registry)) {
        if (normalized === allowed || normalized.endsWith(`.${allowed}`)) {
            return [...jurisdictions];
        }
    }
    return [];
}
function computeWeight(jurisdictions) {
    if (jurisdictions.length === 0) {
        return 0;
    }
    let weight = 0;
    for (const code of jurisdictions) {
        const candidate = JURISDICTION_WEIGHTS.get(code) ?? 0;
        if (candidate > weight) {
            weight = candidate;
        }
    }
    return weight;
}
function chunkDomains(domains, chunkSize) {
    const chunks = [];
    for (let index = 0; index < domains.length; index += chunkSize) {
        chunks.push(domains.slice(index, index + chunkSize));
    }
    return chunks;
}
export function buildWebSearchAllowlist(options = {}) {
    const registry = options.registry ?? OFFICIAL_DOMAIN_REGISTRY;
    const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
    const maxChunks = options.maxChunks && options.maxChunks > 0 ? options.maxChunks : Number.POSITIVE_INFINITY;
    const logger = options.logger ?? null;
    const candidates = options.domains ?? Object.keys(registry);
    const seen = new Map();
    for (const entry of candidates) {
        const domain = normaliseDomain(entry);
        if (!domain || seen.has(domain)) {
            continue;
        }
        const jurisdictions = lookupJurisdictions(domain, registry);
        const weight = computeWeight(jurisdictions);
        seen.set(domain, { domain, jurisdictions, weight });
    }
    const ordered = Array.from(seen.values()).sort((a, b) => {
        if (b.weight !== a.weight) {
            return b.weight - a.weight;
        }
        if (a.jurisdictions.length !== b.jurisdictions.length) {
            return b.jurisdictions.length - a.jurisdictions.length;
        }
        return a.domain.localeCompare(b.domain);
    });
    const fullOrder = ordered.map((entry) => entry.domain);
    const limit = Math.min(fullOrder.length, chunkSize * maxChunks);
    const allowlist = fullOrder.slice(0, limit);
    const dropped = fullOrder.slice(limit);
    const chunks = chunkDomains(allowlist, chunkSize);
    if (chunks.length > 1) {
        const detail = { event: 'web_search_allowlist.chunked', chunkCount: chunks.length, chunkSize, total: allowlist.length };
        incrementCounter('web_search_allowlist.chunked', { chunkCount: chunks.length, chunkSize, total: allowlist.length });
        logger?.debug?.(detail, 'web search allowlist chunked');
    }
    if (dropped.length > 0) {
        const detail = {
            event: 'web_search_allowlist.truncated',
            total: fullOrder.length,
            kept: allowlist.length,
            droppedCount: dropped.length,
            dropped,
        };
        incrementCounter('web_search_allowlist.truncated', {
            total: fullOrder.length,
            kept: allowlist.length,
            dropped: dropped.length,
        });
        logger?.warn?.(detail, 'web search allowlist truncated');
    }
    return { allowlist, chunks, dropped };
}
export { JURISDICTION_PRIORITY };
