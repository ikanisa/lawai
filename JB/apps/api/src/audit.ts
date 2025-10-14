import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

export type AuditPayload = {
  orgId: string;
  actorId?: string | null;
  kind: string;
  object: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent({
  orgId,
  actorId,
  kind,
  object,
  before,
  after,
  metadata,
}: AuditPayload): Promise<void> {
  const { error } = await supabase.from('audit_events').insert({
    org_id: orgId,
    actor_user_id: actorId ?? null,
    kind,
    object,
    before_state: before ?? null,
    after_state: after ?? null,
    metadata: metadata ?? null,
  });

  if (error) {
    throw new Error(`audit_event_failed:${error.message}`);
  }
}
