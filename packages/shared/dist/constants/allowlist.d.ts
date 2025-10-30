export declare const OFFICIAL_DOMAIN_REGISTRY: Readonly<Record<string, readonly string[]>>;
export declare const OFFICIAL_DOMAIN_ALLOWLIST: readonly string[];
export type WebSearchAllowlistSource = 'base' | 'override';
export interface WebSearchAllowlistResult {
    allowlist: string[];
    total: number;
    truncated: boolean;
    truncatedDomains: string[];
    limit: number;
    source: WebSearchAllowlistSource;
}
export interface BuildWebSearchAllowlistOptions {
    base?: readonly string[];
    override?: readonly unknown[] | null;
    limit?: number;
}
export declare function buildWebSearchAllowlist(options?: BuildWebSearchAllowlistOptions): WebSearchAllowlistResult;
export declare function isDomainAllowlisted(url: string): boolean;
export declare function getJurisdictionsForDomain(hostname: string): string[];
//# sourceMappingURL=allowlist.d.ts.map