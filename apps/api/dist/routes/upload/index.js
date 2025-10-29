import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { UploadResponseSchema } from '@avocat-ai/shared';
import { makeStoragePath } from '../../storage.js';
const allowedSourceTypes = ['statute', 'case', 'doctrine', 'internal'];
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
export async function registerUploadRoutes(app, _ctx) {
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
        let residencyZone;
        try {
            const requestedZone = payload.residency_zone ?? (typeof request.headers['x-residency-zone'] === 'string'
                ? request.headers['x-residency-zone']
                : undefined);
            residencyZone = await resolveResidencyZone(ctx, orgId, requestedZone);
        }
        catch (error) {
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
        let quarantineReason;
        try {
            const allowlist = await evaluateAllowlistDomain(ctx, orgId, payload.allowlisted_domain, payload.jurisdiction);
            quarantineReason = allowlist.quarantineReason;
        }
        catch (error) {
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
        const { signedUrl, token } = signed.data;
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
        const documentId = documentInsert.data.id;
        const metadata = {
            filename: payload.filename,
            jurisdiction: payload.jurisdiction,
            sourceType: payload.source_type,
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
