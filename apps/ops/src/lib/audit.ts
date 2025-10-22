import type { SupabaseClient } from '@supabase/supabase-js';
import { standardiseAuditEvent } from '@avocat-ai/shared';

export interface OpsAuditEvent {
  orgId: string;
  actorId?: string | null;
  kind: string;
  object: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  residencyZone?: string | null;
  orgResidency?: string | null;
}

export async function recordOpsAuditEvent(
  supabase: SupabaseClient,
  event: OpsAuditEvent,
): Promise<void> {
  const normalised = standardiseAuditEvent(event);
  const { error } = await supabase.from('audit_events').insert({
    org_id: normalised.orgId,
    actor_user_id: normalised.actorId,
    kind: normalised.kind,
    object: normalised.object,
    before_state: normalised.before,
    after_state: normalised.after,
    metadata: normalised.metadata,
  });

  if (error) {
    throw new Error(`audit_event_failed:${error.message}`);
  }
}
