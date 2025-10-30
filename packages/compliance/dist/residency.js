import { z } from 'zod';
const zoneSchema = z.string().trim().min(2);
export function normaliseResidency(zone) {
    if (!zone)
        return null;
    const trimmed = zone.trim();
    return trimmed.length === 0 ? null : trimmed.toLowerCase();
}
export function resolveResidencyZone(zone, policy) {
    const normalised = normaliseResidency(zone) ?? normaliseResidency(policy.requiredZone) ?? normaliseResidency(policy.fallbackZone);
    if (!normalised) {
        return null;
    }
    zoneSchema.parse(normalised);
    if (policy.allowedZones.length > 0 && !policy.allowedZones.includes(normalised)) {
        throw Object.assign(new Error('residency_zone_restricted'), { statusCode: 428 });
    }
    return normalised;
}
export async function ensureResidencyAllowed(supabase, zone) {
    const { data, error } = await supabase.rpc('storage_residency_allowed', { code: zone });
    if (error) {
        throw new Error(`residency_validation_failed:${error.message}`);
    }
    if (data !== true) {
        throw Object.assign(new Error('residency_zone_invalid'), { statusCode: 428 });
    }
    return true;
}
