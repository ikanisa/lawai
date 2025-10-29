const DEFAULT_STORAGE_FILENAME = 'document';
function pad2(n) {
    return n < 10 ? `0${n}` : String(n);
}
function sanitizeStorageName(name) {
    const safe = name
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
    return safe.length > 0 ? safe : DEFAULT_STORAGE_FILENAME;
}
export function makeStoragePath(orgId, residencyZone, name, now = new Date()) {
    const normalizedZone = residencyZone.trim().toLowerCase();
    if (!normalizedZone) {
        throw new Error('residency_zone_required');
    }
    const yyyy = now.getUTCFullYear();
    const mm = pad2(now.getUTCMonth() + 1);
    const safeName = sanitizeStorageName(name);
    return `${orgId}/${normalizedZone}/${yyyy}/${mm}/${safeName}`;
}
