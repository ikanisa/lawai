import { CorpusDashboardDataSchema, } from '@avocat-ai/shared';
function normaliseDate(value) {
    if (!value) {
        return new Date(0).toISOString();
    }
    return new Date(value).toISOString();
}
function mapJobStatus(status) {
    const normalized = status.toLowerCase();
    if (normalized === 'completed') {
        return { status: 'ready', progress: 100 };
    }
    if (normalized === 'failed') {
        return { status: 'failed', progress: 100 };
    }
    if (normalized === 'quarantined') {
        return { status: 'failed', progress: 0 };
    }
    return { status: 'processing', progress: 25 };
}
function summariseResidency(policyRows, documents) {
    const residencyPolicy = policyRows.find((row) => row.key === 'residency_zone');
    let activeZone = null;
    let allowedZones = null;
    if (residencyPolicy) {
        const value = residencyPolicy.value;
        if (typeof value === 'string') {
            activeZone = value.toLowerCase();
        }
        else if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
                const cleaned = value
                    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
                    .filter((entry) => entry.length > 0);
                if (cleaned.length > 0) {
                    allowedZones = cleaned;
                    activeZone = cleaned[0] ?? null;
                }
            }
            else if ('code' in value) {
                const code = value.code;
                if (typeof code === 'string') {
                    activeZone = code.toLowerCase();
                }
            }
        }
    }
    if (!allowedZones) {
        const zoneSet = new Set();
        for (const doc of documents) {
            if (typeof doc.residency_zone === 'string' && doc.residency_zone.trim()) {
                zoneSet.add(doc.residency_zone.trim().toLowerCase());
            }
        }
        allowedZones = zoneSet.size > 0 ? Array.from(zoneSet) : null;
    }
    if (!activeZone && Array.isArray(allowedZones) && allowedZones.length > 0) {
        activeZone = allowedZones[0] ?? null;
    }
    if (!activeZone && !allowedZones) {
        return undefined;
    }
    return {
        activeZone,
        allowedZones,
    };
}
export async function fetchCorpusDashboard(supabase, orgId) {
    const [allowlistResult, snapshotResult, uploadDocsResult, uploadJobsResult, policyResult] = await Promise.all([
        supabase
            .from('authority_domains')
            .select('host, jurisdiction_code, active, last_ingested_at')
            .eq('org_id', orgId),
        supabase
            .from('documents')
            .select('id, name, created_at, bytes, residency_zone')
            .eq('org_id', orgId)
            .eq('bucket_id', 'authorities')
            .order('created_at', { ascending: false })
            .limit(25),
        supabase
            .from('documents')
            .select('id, name, created_at, residency_zone')
            .eq('org_id', orgId)
            .eq('bucket_id', 'uploads')
            .order('created_at', { ascending: false })
            .limit(25),
        supabase
            .from('upload_ingestion_jobs')
            .select('id, document_id, status, queued_at, progress, quarantine_reason, metadata')
            .eq('org_id', orgId)
            .order('queued_at', { ascending: false })
            .limit(50),
        supabase.from('org_policies').select('key, value').eq('org_id', orgId),
    ]);
    if (allowlistResult.error) {
        throw new Error(allowlistResult.error.message ?? 'allowlist_query_failed');
    }
    if (snapshotResult.error) {
        throw new Error(snapshotResult.error.message ?? 'snapshot_query_failed');
    }
    if (uploadDocsResult.error) {
        throw new Error(uploadDocsResult.error.message ?? 'upload_documents_query_failed');
    }
    if (uploadJobsResult.error) {
        throw new Error(uploadJobsResult.error.message ?? 'upload_jobs_query_failed');
    }
    if (policyResult.error) {
        throw new Error(policyResult.error.message ?? 'policy_query_failed');
    }
    const allowlist = (allowlistResult.data ?? []).map((row) => ({
        id: row.host,
        name: row.host,
        jurisdiction: row.jurisdiction_code ?? 'unknown',
        enabled: row.active !== false,
        lastIndexed: normaliseDate(row.last_ingested_at),
        type: 'official',
    }));
    const snapshots = (snapshotResult.data ?? []).map((row) => ({
        id: row.id,
        label: row.name,
        createdAt: normaliseDate(row.created_at ?? undefined),
        author: 'Ingestion Pipeline',
        sizeMb: row.bytes ? Number((row.bytes / (1024 * 1024)).toFixed(2)) : 0,
    }));
    const uploadDocuments = (uploadDocsResult.data ?? []);
    const uploadJobs = (uploadJobsResult.data ?? []);
    const documentById = new Map(uploadDocuments.map((doc) => [doc.id, doc]));
    const ingestionJobs = uploadJobs.map((job) => {
        const doc = documentById.get(job.document_id);
        const mappedStatus = mapJobStatus(job.status ?? 'pending');
        const noteParts = [];
        if (job.quarantine_reason) {
            noteParts.push(`Quarantine: ${job.quarantine_reason}`);
        }
        return {
            id: job.id,
            filename: doc?.name ??
                (typeof job.metadata?.filename === 'string' ? job.metadata.filename : `upload-${job.id}`),
            status: mappedStatus.status,
            submittedAt: normaliseDate(job.queued_at ?? undefined),
            jurisdiction: typeof job.metadata?.jurisdiction === 'string'
                ? job.metadata.jurisdiction
                : doc?.residency_zone ?? 'unknown',
            progress: job.progress ?? mappedStatus.progress,
            note: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
        };
    });
    const uploads = uploadDocuments.map((doc) => {
        const job = uploadJobs.find((entry) => entry.document_id === doc.id);
        return {
            id: doc.id,
            name: doc.name,
            createdAt: normaliseDate(doc.created_at ?? undefined),
            residencyZone: doc.residency_zone ?? null,
            status: job ? (job.status === 'completed' ? 'indexed' : job.status === 'failed' ? 'failed' : 'queued') : 'queued',
        };
    });
    const residency = summariseResidency((policyResult.data ?? []), uploadDocuments);
    const payload = {
        allowlist,
        integrations: [],
        snapshots,
        ingestionJobs,
        uploads,
        residency,
    };
    return CorpusDashboardDataSchema.parse(payload);
}
