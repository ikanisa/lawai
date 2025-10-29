type DomainRegistry = Readonly<Record<string, readonly string[]>>;
export interface AllowlistLogger {
    debug?(obj: Record<string, unknown>, message?: string): void;
    info?(obj: Record<string, unknown>, message?: string): void;
    warn?(obj: Record<string, unknown>, message?: string): void;
}
export interface BuildWebSearchAllowlistOptions {
    domains?: Iterable<string | null | undefined>;
    chunkSize?: number;
    maxChunks?: number;
    registry?: DomainRegistry;
    logger?: AllowlistLogger | null;
}
export interface WebSearchAllowlistResult {
    allowlist: string[];
    chunks: string[][];
    dropped: string[];
}
declare const JURISDICTION_PRIORITY: readonly ["FR", "BE", "LU", "CH", "CA-QC", "CA", "MC", "EU", "OHADA", "OAPI", "CIMA", "MA", "TN", "DZ", "RW"];
export declare function buildWebSearchAllowlist(options?: BuildWebSearchAllowlistOptions): WebSearchAllowlistResult;
export { JURISDICTION_PRIORITY };
//# sourceMappingURL=web-search-allowlist.d.ts.map