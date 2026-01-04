
export class ResidencyError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = 'ResidencyError';
        this.statusCode = statusCode;
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

export function determineResidencyZone(
    orgId: string,
    context: OrgAccessContext, // access object
    requestedZone?: string | null
): string | null {
    if (requestedZone) {
        // Simple validation: check if requested is allowed
        const allowed = context.allowedZones ?? [];
        if (allowed.length > 0 && !allowed.includes(requestedZone)) {
            throw new ResidencyError('invalid_zone');
        }
        return requestedZone;
    }

    // Default to first allowed or generic fallback
    const allowed = context.allowedZones ?? [];
    if (allowed.length > 0) {
        return allowed[0];
    }

    return null;
}

export function extractResidencyFromPath(path: string): string | null {
    if (!path) return null;
    const parts = path.split('/');
    // Heuristic: check for known zones in path segments
    const knownZones = ['eu', 'us', 'ca', 'fr'];
    for (const part of parts) {
        if (knownZones.includes(part.toLowerCase())) {
            return part.toLowerCase();
        }
    }
    return null;
}
