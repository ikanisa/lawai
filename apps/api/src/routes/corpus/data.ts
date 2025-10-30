import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CorpusDashboardDataSchema,
  type CorpusDashboardData,
  type ResidencySummary,
} from '@avocat-ai/shared';

interface AuthorityDomainRow {
  host: string;
  jurisdiction_code?: string | null;
  active?: boolean | null;
  last_ingested_at?: string | null;
}

interface DocumentRow {
  id: string;
  name: string;
  created_at?: string | null;
  bytes?: number | null;
  residency_zone?: string | null;
}

interface UploadJobRow {
  id: string;
  document_id: string;
  status: string;
  queued_at?: string | null;
  progress?: number | null;
  quarantine_reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

function normaliseDate(value?: string | null): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  return new Date(value).toISOString();
}

function mapJobStatus(status: string): { status: 'processing' | 'failed' | 'ready'; progress: number } {
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

function summariseResidency(
  policyRows: Array<{ key: string; value: unknown }>,
  documents: DocumentRow[],
): ResidencySummary | undefined {
  const residencyPolicy = policyRows.find((row) => row.key === 'residency_zone');
  let activeZone: string | null = null;
  let allowedZones: string[] | null = null;

  if (residencyPolicy) {
    const value = residencyPolicy.value;
    if (typeof value === 'string') {
      activeZone = value.toLowerCase();
    } else if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        const cleaned = value
          .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
          .filter((entry) => entry.length > 0);
        if (cleaned.length > 0) {
          allowedZones = cleaned;
          activeZone = cleaned[0] ?? null;
        }
      } else if ('code' in (value as Record<string, unknown>)) {
        const code = (value as Record<string, unknown>).code;
        if (typeof code === 'string') {
          activeZone = code.toLowerCase();
        }
      }
    }
  }

  if (!allowedZones) {
    const zoneSet = new Set<string>();
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

export async function fetchCorpusDashboard(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CorpusDashboardData> {
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

  const allowlist = (allowlistResult.data ?? []).map((row: AuthorityDomainRow) => ({
    id: row.host,
    name: row.host,
    jurisdiction: row.jurisdiction_code ?? 'unknown',
    enabled: row.active !== false,
    lastIndexed: normaliseDate(row.last_ingested_at),
    type: 'official' as const,
  }));

  const snapshots = (snapshotResult.data ?? []).map((row: DocumentRow) => ({
    id: row.id,
    label: row.name,
    createdAt: normaliseDate(row.created_at ?? undefined),
    author: 'Ingestion Pipeline',
    sizeMb: row.bytes ? Number((row.bytes / (1024 * 1024)).toFixed(2)) : 0,
  }));

  const uploadDocuments = (uploadDocsResult.data ?? []) as DocumentRow[];
  const uploadJobs = (uploadJobsResult.data ?? []) as UploadJobRow[];
  const documentById = new Map(uploadDocuments.map((doc) => [doc.id, doc] as const));

  const ingestionJobs = uploadJobs.map((job) => {
    const doc = documentById.get(job.document_id);
    const mappedStatus = mapJobStatus(job.status ?? 'pending');
    const noteParts: string[] = [];
    if (job.quarantine_reason) {
      noteParts.push(`Quarantine: ${job.quarantine_reason}`);
    }
    return {
      id: job.id,
      filename:
        doc?.name ??
        (typeof job.metadata?.filename === 'string' ? (job.metadata.filename as string) : `upload-${job.id}`),
      status: mappedStatus.status,
      submittedAt: normaliseDate(job.queued_at ?? undefined),
      jurisdiction:
        typeof job.metadata?.jurisdiction === 'string'
          ? (job.metadata.jurisdiction as string)
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

  const residency = summariseResidency((policyResult.data ?? []) as Array<{ key: string; value: unknown }>, uploadDocuments);

  const payload = {
    allowlist,
    integrations: [],
    snapshots,
    ingestionJobs,
    uploads,
    residency,
  } satisfies CorpusDashboardData;

  return CorpusDashboardDataSchema.parse(payload);
}

import {
  SearchParamsSchema,
  type SearchResultsPage,
  getOpenAIClient,
  getVectorStoreApi,
} from '@avocat-ai/shared';
import { env } from '../../config.js';

export async function searchVectorStore(requestBody: unknown): Promise<SearchResultsPage> {
  // Validate request body
  const parseResult = SearchParamsSchema.safeParse(requestBody);
  if (!parseResult.success) {
    throw new Error(`Invalid search parameters: ${parseResult.error.message}`);
  }

  const searchParams = parseResult.data;
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID || env.OPENAI_VECTOR_STORE_AUTHORITIES_ID;

  if (!vectorStoreId) {
    throw new Error('Vector store ID is not configured');
  }

  // Get OpenAI client and vector store API
  const openai = getOpenAIClient({
    apiKey: env.OPENAI_API_KEY,
    cacheKeySuffix: 'api-corpus-search',
    requestTags: process.env.OPENAI_REQUEST_TAGS_API ?? process.env.OPENAI_REQUEST_TAGS ?? 'service=api,component=corpus-search',
  });

  const vectorStoreApi = getVectorStoreApi(openai);

  // Check if search is supported
  if (!vectorStoreApi.search) {
    throw new Error('Vector store search is not supported by this OpenAI client version');
  }

  // Perform the search
  const result = await vectorStoreApi.search(vectorStoreId, searchParams);

  return result;
}
