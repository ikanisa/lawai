export type AuditObjectState = Record<string, unknown> | null | undefined;

export interface AuditEventInput {
  orgId: string;
  actorId?: string | null;
  kind: string;
  object: string;
  before?: AuditObjectState;
  after?: AuditObjectState;
  metadata?: Record<string, unknown> | null;
  residencyZone?: string | null;
}

export interface StandardisedAuditEvent {
  orgId: string;
  actorId: string | null;
  kind: string;
  object: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'apiKey',
  'api_key',
  'clientSecret',
  'client_secret',
  'authorization',
  'auth_header',
  'privateKey',
  'private_key',
]);

function redactPrimitive(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length > 256) {
      return `${value.slice(0, 200)}…[truncated]`;
    }
    if (/sk-[a-z0-9]{20,}/i.test(value) || /secret|token|password/i.test(value)) {
      return '[REDACTED]';
    }
    return value;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function redactRecord(input: AuditObjectState): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  if (Array.isArray(input)) {
    return input.map((value) => {
      if (value && typeof value === 'object') {
        return redactRecord(value as Record<string, unknown>);
      }
      return redactPrimitive(value);
    }) as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    if (value && typeof value === 'object') {
      result[key] = redactRecord(value as Record<string, unknown>);
    } else {
      result[key] = redactPrimitive(value);
    }
  }
  return result;
}

export function enforceResidency(orgResidency: string | null | undefined, dataResidency: string | null | undefined): boolean {
  if (!orgResidency || !dataResidency) {
    return true;
  }
  return orgResidency.toLowerCase() === dataResidency.toLowerCase();
}

export function standardiseAuditEvent(input: AuditEventInput & { orgResidency?: string | null }): StandardisedAuditEvent {
  const metadata = { ...(input.metadata ?? {}) };
  if (input.residencyZone) {
    metadata.residency_zone = input.residencyZone;
  }
  if (input.orgResidency && input.residencyZone) {
    metadata.residency_allowed = enforceResidency(input.orgResidency, input.residencyZone);
  }
  if (metadata.policy_version) {
    metadata.policy_version = redactPrimitive(metadata.policy_version);
  }
  return {
    orgId: input.orgId,
    actorId: input.actorId ?? null,
    kind: input.kind,
    object: input.object,
    before: redactRecord(input.before) ?? null,
    after: redactRecord(input.after) ?? null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}
