import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
const supabase = createServiceClient({
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});
export async function logAuditEvent({ orgId, actorId, kind, object, before, after, metadata, }) {
    const mergedMetadata = {
        ...(metadata ?? {}),
        ...env.POLICY_VERSION ? { policy_version: env.POLICY_VERSION } : {},
    };
    const { error } = await supabase.from('audit_events').insert({
        org_id: orgId,
        actor_user_id: actorId ?? null,
        kind,
        object,
        before_state: before ?? null,
        after_state: after ?? null,
        metadata: mergedMetadata,
    });
    if (error) {
        throw new Error(`audit_event_failed:${error.message}`);
    }
}
