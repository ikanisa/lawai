export interface ResidencyPolicy {
    allowedZones: string[];
    requiredZone?: string | null;
    fallbackZone?: string | null;
}
export declare function normaliseResidency(zone: string | null | undefined): string | null;
export declare function resolveResidencyZone(zone: string | null | undefined, policy: ResidencyPolicy): string | null;
export declare function ensureResidencyAllowed(supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: unknown;
        error: {
            message: string;
        } | null;
    }>;
}, zone: string): Promise<boolean>;
//# sourceMappingURL=residency.d.ts.map