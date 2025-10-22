import redactFactory from 'fast-redact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type AuditRecord = {
  orgId: string;
  actorId?: string | null;
  kind: string;
  object: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  residency?: string | null;
};

export interface AuditLoggerOptions {
  redactionPaths?: string[];
  metadataAllowList?: string[];
  defaultResidency?: string | null;
}

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

function cloneAndSanitise(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
      continue;
    }
    if (value instanceof Date) {
      output[key] = value.toISOString();
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value.map((entry) => (typeof entry === 'object' && entry !== null ? cloneAndSanitise(entry as any) : entry));
      continue;
    }
    if (typeof value === 'object') {
      output[key] = cloneAndSanitise(value as Record<string, unknown>);
      continue;
    }
    output[key] = String(value);
  }
  return output;
}

function filterMetadata(metadata: Record<string, unknown> | null, allowList?: string[]): Record<string, unknown> | null {
  if (!metadata) return null;
  const safe = cloneAndSanitise(metadata);
  if (!safe) return null;
  if (!allowList || allowList.length === 0) {
    for (const key of Object.keys(safe)) {
      const value = safe[key];
      if (!metadataValueSchema.safeParse(value).success) {
        safe[key] = JSON.stringify(value);
      }
    }
    return safe;
  }
  const filtered: Record<string, unknown> = {};
  for (const key of allowList) {
    if (key in safe) {
      const value = safe[key];
      filtered[key] = metadataValueSchema.safeParse(value).success ? value : JSON.stringify(value);
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

export class AuditLogger {
  private readonly redact: (input: Record<string, unknown>) => Record<string, unknown>;

  constructor(private readonly supabase: SupabaseClient, private readonly options: AuditLoggerOptions = {}) {
    this.redact = redactFactory({
      paths: options.redactionPaths ?? DEFAULT_REDACTION_PATHS,
      censor: '***',
      serialize: false,
    });
  }

  private applyRedaction(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!input) return null;
    const clone = cloneAndSanitise(input);
    if (!clone) return null;
    return this.redact(clone) as Record<string, unknown>;
  }

  async log(record: AuditRecord): Promise<void> {
    const payload: AuditRecord = {
      ...record,
      residency: record.residency ?? this.options.defaultResidency ?? null,
      before: this.applyRedaction(record.before),
      after: this.applyRedaction(record.after),
      metadata: filterMetadata(record.metadata ?? null, this.options.metadataAllowList),
    };

    const { error } = await this.supabase.from('audit_events').insert({
      org_id: payload.orgId,
      actor_user_id: payload.actorId ?? null,
      kind: payload.kind,
      object: payload.object,
      before_state: payload.before ?? null,
      after_state: payload.after ?? null,
      metadata: payload.metadata ?? null,
      residency_zone: payload.residency ?? null,
    });

    if (error) {
      throw new Error(`audit_event_failed:${error.message}`);
    }
  }
}
