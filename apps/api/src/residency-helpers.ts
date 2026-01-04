
export class ResidencyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResidencyError';
    }
}

export interface OrgAccessContext {
    orgId: string;
    allowedZones?: string[];
    [key: string]: unknown;
}

export function collectAllowedResidencyZones(context: OrgAccessContext): string[] {
    return context.allowedZones ?? [];
}

export function determineResidencyZone(zones: string[] | null | undefined): string | null {
    if (!zones || zones.length === 0) {
        return null;
    }
    // Simplified logic: return first zone or 'eu' if available
    if (zones.includes('eu')) {
        return 'eu';
    }
    return zones[0];
}

export function extractResidencyFromPath(path: string): string | null {
    // Simplified logic
    return null;
}
