import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UploadResponseSchema } from '@avocat-ai/shared';

import { makeStoragePath } from '../../storage.js';
import type { AppContext } from '../../types/context.js';
import { registerUploadWorker } from './worker.js';

const allowedSourceTypes = ['statute', 'case', 'doctrine', 'internal'] as const;

type AllowedSourceType = (typeof allowedSourceTypes)[number];

const guardrailTagSchema = z.string().min(2).max(64);

const uploadRequestSchema = z
  .object({
    filename: z.string().min(1),
    content_type: z.string().min(1).default('application/pdf'),
    bytes: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
    jurisdiction: z.string().min(2),
    source_type: z.enum(allowedSourceTypes).default('internal'),
    hash_sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'hash must be sha256').optional(),
    allowlisted_domain: z.string().url().optional(),
    residency_zone: z.string().min(2).optional(),
    guardrail_tags: z.array(guardrailTagSchema).default([]),
    confidentiality: z.enum(['public', 'internal', 'confidential']).default('internal'),
  })
  .strict();

class UploadRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function resolveResidencyZone(
  ctx: AppContext,
  orgId: string,
  requestedZone?: string | null,
): Promise<string> {
  const requested = typeof requestedZone === 'string' ? requestedZone.trim().toLowerCase() : '';
  const candidate = requested || 'eu';

  const { data: allowed, error: allowedError } = await ctx.supabase.rpc('storage_residency_allowed', {
    code: candidate,
  });
  if (allowedError) {
    throw new UploadRequestError('residency_validation_failed', 500);
  }
  if (allowed !== true) {
    throw new UploadRequestError('residency_zone_invalid', 400);
  }

  const { data: orgAllowed, error: orgAllowedError } = await ctx.supabase.rpc('org_residency_allows', {
    org_uuid: orgId,
    zone: candidate,
  });
  if (orgAllowedError) {
    throw new UploadRequestError('residency_validation_failed', 500);
  }
  if (orgAllowed !== true) {
    throw new UploadRequestError('residency_zone_restricted', 428);
  }

  return candidate;
}

function parseByteSize(input?: number | string): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === 'string' && input.trim()) {
    const value = Number.parseInt(input, 10);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function normaliseGuardrailTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
}

async function evaluateAllowlistDomain(
  ctx: AppContext,
  orgId: string,
  domainUrl?: string,
  jurisdiction?: string,
): Promise<{ host?: string; quarantineReason?: string }> {
  if (!domainUrl) {
    return {};
  }

  let host: string;
  try {
    host = new URL(domainUrl).host.toLowerCase();
  } catch {
    return { quarantineReason: 'invalid_domain_url' };
  }

  const query = ctx.supabase
    .from('authority_domains')
    .select('host, active, jurisdiction_code')
    .eq('org_id', orgId)
    .eq('host', host)
    .maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw new UploadRequestError('allowlist_lookup_failed', 500);
  }

  if (!data) {
    return { host, quarantineReason: 'domain_not_allowlisted' };
  }

  const isActive = data.active !== false;
  if (!isActive) {
    return { host, quarantineReason: 'domain_disabled' };
  }

  if (jurisdiction && typeof data.jurisdiction_code === 'string') {
    const sameJurisdiction = data.jurisdiction_code.toLowerCase() === jurisdiction.toLowerCase();
    if (!sameJurisdiction) {
      return { host, quarantineReason: 'jurisdiction_mismatch' };
    }
  }

  return { host };
}

function mapJobStatusToUploadState(status: string): 'queued' | 'processing' | 'indexed' {
  const normalized = status.toLowerCase();
  if (normalized === 'processing') {
    return 'processing';
  }
  if (normalized === 'completed') {
    return 'indexed';
  }
  return 'queued';
}

export async function registerUploadRoutes(app: FastifyInstance, ctx: AppContext) {
  const interval = Number.parseInt(process.env.UPLOAD_WORKER_INTERVAL_MS ?? '', 10);
  registerUploadWorker(app, ctx.supabase, {
    intervalMs: Number.isFinite(interval) && interval > 0 ? interval : undefined,
  });

  app.post('/upload', async (request, reply) => {
    const orgHeader = request.headers['x-org-id'];
    if (typeof orgHeader !== 'string' || !orgHeader.trim()) {
      return reply.code(400).send({ error: 'org_id_required' });
    }
    const orgId = orgHeader.trim();

    const userHeader = request.headers['x-user-id'];
    const maybeUser = typeof userHeader === 'string' ? userHeader.trim() : '';
    const submittedBy = z
      .string()
      .uuid()
      .safeParse(maybeUser);

    const bodyParse = uploadRequestSchema.safeParse(request.body ?? {});
    if (!bodyParse.success) {
      return reply.code(400).send({ error: 'invalid_request', details: bodyParse.error.flatten() });
    }

    const payload = bodyParse.data;

    let residencyZone: string;
    try {
      const requestedZone = payload.residency_zone ?? (typeof request.headers['x-residency-zone'] === 'string'
        ? request.headers['x-residency-zone']
        : undefined);
      residencyZone = await resolveResidencyZone(ctx, orgId, requestedZone);
    } catch (error) {
      if (error instanceof UploadRequestError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'resolve_residency_failed');
      return reply.code(500).send({ error: 'residency_resolution_failed' });
    }

    const bytes = parseByteSize(payload.bytes);
    if (bytes !== null && bytes < 0) {
      return reply.code(400).send({ error: 'invalid_file_size' });
    }

    const guardrailTags = normaliseGuardrailTags(payload.guardrail_tags ?? []);

    let quarantineReason: string | undefined;
    try {
      const allowlist = await evaluateAllowlistDomain(ctx, orgId, payload.allowlisted_domain, payload.jurisdiction);
      quarantineReason = allowlist.quarantineReason;
    } catch (error) {
      if (error instanceof UploadRequestError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'allowlist_lookup_failed');
      return reply.code(500).send({ error: 'allowlist_lookup_failed' });
    }

    const storagePath = makeStoragePath(orgId, residencyZone, payload.filename);
    const ttlSeconds = 5 * 60;
    const signed = await ctx.supabase.storage
      .from('uploads')
      .createSignedUploadUrl(storagePath, ttlSeconds);

    if (signed.error || !signed.data) {
      request.log.error({ err: signed.error ?? 'unknown' }, 'signed_upload_failed');
      return reply.code(500).send({ error: 'signed_upload_failed' });
    }

    const { signedUrl, token } = signed.data as { signedUrl?: string; token?: string };
    if (!signedUrl || !token) {
      request.log.error({ signed: signed.data }, 'signed_upload_invalid_payload');
      return reply.code(500).send({ error: 'signed_upload_invalid' });
    }

    const receivedAt = new Date().toISOString();

    const documentInsert = await ctx.supabase
      .from('documents')
      .insert({
        id: randomUUID(),
        org_id: orgId,
        name: payload.filename,
        storage_path: storagePath,
        bucket_id: 'uploads',
        mime_type: payload.content_type,
        bytes,
        residency_zone: residencyZone,
        vector_store_status: 'pending',
      })
      .select('id')
      .single();

    if (documentInsert.error || !documentInsert.data) {
      if (documentInsert.error?.code === '23505') {
        return reply.code(409).send({ error: 'document_exists' });
      }
      request.log.error({ err: documentInsert.error }, 'document_insert_failed');
      return reply.code(500).send({ error: 'document_insert_failed' });
    }

    const documentId = documentInsert.data.id as string;

    const metadata = {
      filename: payload.filename,
      jurisdiction: payload.jurisdiction,
      sourceType: payload.source_type as AllowedSourceType,
      allowlistedDomain: payload.allowlisted_domain ?? null,
      guardrailTags,
      confidentiality: payload.confidentiality,
      hash: payload.hash_sha256 ?? null,
      bytes,
      contentType: payload.content_type,
    };

    const jobInsert = await ctx.supabase
      .from('upload_ingestion_jobs')
      .insert({
        org_id: orgId,
        document_id: documentId,
        submitted_by: submittedBy.success ? submittedBy.data : null,
        status: quarantineReason ? 'quarantined' : 'pending',
        hash_sha256: payload.hash_sha256 ?? null,
        confidentiality: payload.confidentiality,
        guardrail_tags: guardrailTags,
        metadata,
        quarantine_reason: quarantineReason ?? null,
        progress: quarantineReason ? 0 : 5,
      })
      .select('id, status, quarantine_reason')
      .single();

    if (jobInsert.error || !jobInsert.data) {
      request.log.error({ err: jobInsert.error }, 'upload_job_insert_failed');
      return reply.code(500).send({ error: 'upload_job_insert_failed' });
    }

    if (quarantineReason) {
      const quarantinePayload = {
        org_id: orgId,
        adapter_id: 'file_upload',
        source_url: payload.allowlisted_domain ?? `upload://${documentId}`,
        canonical_url: payload.allowlisted_domain ?? null,
        reason: quarantineReason,
        metadata: {
          document_id: documentId,
          filename: payload.filename,
          jurisdiction: payload.jurisdiction,
          source_type: payload.source_type,
          guardrail_tags: guardrailTags,
        },
      };

      const quarantineInsert = await ctx.supabase.from('ingestion_quarantine').insert(quarantinePayload);
      if (quarantineInsert.error) {
        request.log.warn({ err: quarantineInsert.error }, 'quarantine_record_failed');
      }
    }

    const response = UploadResponseSchema.parse({
      uploadId: jobInsert.data.id,
      status: mapJobStatusToUploadState(jobInsert.data.status ?? 'pending'),
      receivedAt,
      upload: {
        bucket: 'uploads',
        path: storagePath,
        url: signedUrl,
        token,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      quarantine: quarantineReason
        ? {
            reason: quarantineReason,
            status: 'pending',
          }
        : undefined,
    });

    return response;
  });
}
