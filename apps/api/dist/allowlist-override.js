import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';
import { incrementCounter } from './observability/metrics.js';
const DOMAIN_PRIORITY = new Map(OFFICIAL_DOMAIN_ALLOWLIST.map((domain, index) => [domain.toLowerCase(), index]));
const DEFAULT_MAX_OVERRIDE_ENTRIES = 20;
const DEFAULT_TELEMETRY = {
    log(level, message, context = {}) {
        if (level === 'warn') {
            console.warn(message, context);
        }
        else {
            console.info(message, context);
        }
    },
    metric(name, labels) {
        incrementCounter(name, labels);
    },
};
function normaliseDomain(entry) {
    if (typeof entry !== 'string') {
        return null;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
        return null;
    }
    const lowered = trimmed.toLowerCase();
    const withoutProtocol = lowered.replace(/^https?:\/\//, '');
    const withoutPort = withoutProtocol.split(':')[0] ?? withoutProtocol;
    const withoutPath = withoutPort.split('/')[0] ?? withoutPort;
    const withoutWww = withoutPath.replace(/^www\./, '');
    const domain = withoutWww.trim();
    return domain ? domain : null;
}
function sortByCanonicalOrder(domains) {
    return domains
        .slice()
        .sort((a, b) => (DOMAIN_PRIORITY.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) - (DOMAIN_PRIORITY.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER));
}
export function resolveDomainAllowlistOverride(rawValue, options = {}) {
    if (!Array.isArray(rawValue)) {
        return null;
    }
    const telemetry = {
        ...DEFAULT_TELEMETRY,
        ...(options.telemetry ?? {}),
    };
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_OVERRIDE_ENTRIES;
    const seen = new Set();
    const accepted = [];
    let duplicateCount = 0;
    let unknownCount = 0;
    for (const entry of rawValue) {
        const normalised = normaliseDomain(entry);
        if (!normalised) {
            unknownCount += 1;
            continue;
        }
        if (!DOMAIN_PRIORITY.has(normalised)) {
            unknownCount += 1;
            continue;
        }
        if (seen.has(normalised)) {
            duplicateCount += 1;
            continue;
        }
        seen.add(normalised);
        accepted.push(normalised);
    }
    const ordered = sortByCanonicalOrder(accepted);
    const truncatedCount = Math.max(ordered.length - maxEntries, 0);
    const finalList = truncatedCount > 0 ? ordered.slice(0, maxEntries) : ordered;
    if (duplicateCount > 0) {
        telemetry.metric('allowlist.override.duplicates_dropped', { count: duplicateCount });
    }
    if (unknownCount > 0) {
        telemetry.metric('allowlist.override.unknown_dropped', { count: unknownCount });
    }
    if (truncatedCount > 0) {
        telemetry.metric('allowlist.override.truncated', { count: truncatedCount });
    }
    if (duplicateCount > 0 || unknownCount > 0 || truncatedCount > 0) {
        telemetry.log('warn', 'allowlist_override_pruned', {
            requested: rawValue.length,
            accepted: finalList.length,
            duplicates: duplicateCount,
            unknown: unknownCount,
            truncated: truncatedCount,
        });
    }
    return finalList;
}
export const MAX_DOMAIN_OVERRIDE_ENTRIES = DEFAULT_MAX_OVERRIDE_ENTRIES;
