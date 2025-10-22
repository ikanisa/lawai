import { createServiceClient } from '@avocat-ai/supabase';
import { standardiseAuditEvent } from '@avocat-ai/shared';
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
  residencyZone?: string | null;
  orgResidency?: string | null;
};

export async function logAuditEvent({
  orgId,
  actorId,
  kind,
  object,
  before,
  after,
  metadata,
  residencyZone,
  orgResidency,
}: AuditPayload): Promise<void> {
  const mergedMetadata = {
    ...(metadata ?? {}),
    ...(env as { POLICY_VERSION?: string }).POLICY_VERSION ? { policy_version: (env as any).POLICY_VERSION } : {},
  } as Record<string, unknown>;

  const event = standardiseAuditEvent({
    orgId,
    actorId,
    kind,
    object,
    before,
    after,
    metadata: mergedMetadata,
    residencyZone: residencyZone ?? (mergedMetadata.residency_zone as string | null | undefined) ?? null,
    orgResidency: orgResidency ?? (mergedMetadata.org_residency as string | null | undefined) ?? null,
  });

  const { error } = await supabase.from('audit_events').insert({
    org_id: event.orgId,
    actor_user_id: event.actorId,
    kind: event.kind,
    object: event.object,
    before_state: event.before,
    after_state: event.after,
    metadata: event.metadata,
  });

  if (error) {
    throw new Error(`audit_event_failed:${error.message}`);
  }
}
