export declare const OFFICIAL_DOMAIN_REGISTRY: Readonly<Record<string, readonly string[]>>;
export declare const OFFICIAL_DOMAIN_ALLOWLIST: readonly string[];
export declare const DEFAULT_WEB_SEARCH_ALLOWLIST_MAX = 20;
export interface BuildWebSearchAllowlistOptions {
    fallback: readonly string[];
    override?: readonly unknown[] | null | undefined;
    maxDomains?: number;
    onTruncate?: (details: {
        truncatedCount: number;
        totalDomains: number;
        maxDomains: number;
        source: 'override' | 'fallback';
    }) => void;
}
export interface BuildWebSearchAllowlistResult {
    allowlist: string[];
    truncated: boolean;
    truncatedCount: number;
    totalDomains: number;
    source: 'override' | 'fallback';
}
export declare function buildWebSearchAllowlist(options: BuildWebSearchAllowlistOptions): BuildWebSearchAllowlistResult;
export declare function isDomainAllowlisted(url: string): boolean;
export declare function getJurisdictionsForDomain(hostname: string): string[];
//# sourceMappingURL=allowlist.d.ts.map
