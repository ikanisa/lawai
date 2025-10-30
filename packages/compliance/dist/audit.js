import redactFactory from 'fast-redact';
import { z } from 'zod';
const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const DEFAULT_REDACTION_PATHS = [
    'before.password',
    'after.password',
    'before.secret',
    'after.secret',
    'before.token',
    'after.token',
    'metadata.token',
    'metadata.secrets',
    'metadata.raw',
];
function cloneAndSanitise(input) {
    if (!input)
        return null;
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined)
            continue;
        if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            output[key] = value;
            continue;
        }
        if (value instanceof Date) {
            output[key] = value.toISOString();
            continue;
        }
        if (Array.isArray(value)) {
            output[key] = value.map((entry) => (typeof entry === 'object' && entry !== null ? cloneAndSanitise(entry) : entry));
            continue;
        }
        if (typeof value === 'object') {
            output[key] = cloneAndSanitise(value);
            continue;
        }
        output[key] = String(value);
    }
    return output;
}
function filterMetadata(metadata, allowList) {
    if (!metadata)
        return null;
    const safe = cloneAndSanitise(metadata);
    if (!safe)
        return null;
    if (!allowList || allowList.length === 0) {
        for (const key of Object.keys(safe)) {
            const value = safe[key];
            if (!metadataValueSchema.safeParse(value).success) {
                safe[key] = JSON.stringify(value);
            }
        }
        return safe;
    }
    const filtered = {};
    for (const key of allowList) {
        if (key in safe) {
            const value = safe[key];
            filtered[key] = metadataValueSchema.safeParse(value).success ? value : JSON.stringify(value);
        }
    }
    return Object.keys(filtered).length > 0 ? filtered : null;
}
export class AuditLogger {
    supabase;
    options;
    redact;
    constructor(supabase, options = {}) {
        this.supabase = supabase;
        this.options = options;
        this.redact = redactFactory({
            paths: options.redactionPaths ?? DEFAULT_REDACTION_PATHS,
            censor: '***',
            serialize: false,
        });
    }
    applyRedaction(input, rootPath) {
        if (!input)
            return null;
        const clone = cloneAndSanitise(input);
        if (!clone)
            return null;
        const directRedacted = this.redact(clone);
        if (!rootPath) {
            return directRedacted;
        }
        const wrapper = { [rootPath]: directRedacted };
        this.redact(wrapper);
        const extracted = wrapper[rootPath];
        if (!extracted || typeof extracted !== 'object') {
            return null;
        }
        return extracted;
    }
    async log(record) {
        const redactedMetadata = this.applyRedaction(record.metadata, 'metadata');
        const payload = {
            ...record,
            residency: record.residency ?? this.options.defaultResidency ?? null,
            before: this.applyRedaction(record.before, 'before'),
            after: this.applyRedaction(record.after, 'after'),
            metadata: filterMetadata(redactedMetadata, this.options.metadataAllowList),
        };
        const { error } = await this.supabase
            .from('audit_events')
            .insert({
            org_id: payload.orgId,
            actor_user_id: payload.actorId ?? null,
            kind: payload.kind,
            object: payload.object,
            before_state: payload.before ?? null,
            after_state: payload.after ?? null,
            metadata: payload.metadata ?? null,
            residency_zone: payload.residency ?? null,
        })
            .select('id')
            .maybeSingle();
        if (error) {
            throw new Error(`audit_event_failed:${error.message}`);
        }
    }
}
