import { serverEnv } from '../env.server.js';

type JsonRecord = Record<string, unknown>;

type EvalJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CreateEvalJobOptions {
  datasetId: string;
  agentId: string;
  metadata?: JsonRecord;
  tags?: string[];
  runName?: string;
}

export interface PollEvalJobOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export interface EvalJobMetrics {
  allowlistedCitationPrecisionP95: number | null;
  temporalValidityP95: number | null;
  maghrebBannerCoverage: number | null;
  hitlRecallHighRisk: number | null;
  [key: string]: number | null;
}

export interface EvalJobResult {
  id: string;
  status: EvalJobStatus;
  error: string | null;
  metrics: EvalJobMetrics;
  metadata: JsonRecord;
  datasetId: string | null;
  agentId: string | null;
  raw: JsonRecord;
}

interface OpenAIEvalsClientConfig {
  apiKey: string;
  baseUrl: string;
  requestTags?: string;
}

type RawEvalJob = JsonRecord & {
  id?: string;
  status?: string;
  error?: unknown;
  dataset_id?: string;
  agent_id?: string;
  metadata?: JsonRecord;
  result?: unknown;
  metrics?: unknown;
};

type MetricCandidate = Record<string, unknown> | undefined | null;

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1_000;

function assertApiKey(value: string | undefined): asserts value is string {
  if (!value || value.length === 0) {
    throw new Error('OPENAI_API_KEY must be defined to call the OpenAI Evals API');
  }
}

function normaliseStatus(value: unknown): EvalJobStatus {
  if (typeof value !== 'string') {
    return 'queued';
  }
  const normalised = value.toLowerCase();
  if (normalised === 'completed' || normalised === 'succeeded' || normalised === 'success') {
    return 'completed';
  }
  if (normalised === 'failed' || normalised === 'errored' || normalised === 'error') {
    return 'failed';
  }
  if (normalised === 'cancelled' || normalised === 'canceled') {
    return 'cancelled';
  }
  if (normalised === 'running' || normalised === 'in_progress' || normalised === 'processing') {
    return 'running';
  }
  return 'queued';
}

function metricFromCandidate(candidate: MetricCandidate, keys: string[]): number | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = (candidate as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function extractMetrics(job: RawEvalJob): EvalJobMetrics {
  const candidates: MetricCandidate[] = [];
  if (job.result && typeof job.result === 'object') {
    const result = job.result as Record<string, unknown>;
    if (result.metrics && typeof result.metrics === 'object') {
      candidates.push(result.metrics as Record<string, unknown>);
    }
    if (result.summary && typeof result.summary === 'object') {
      const summary = result.summary as Record<string, unknown>;
      if (summary.metrics && typeof summary.metrics === 'object') {
        candidates.push(summary.metrics as Record<string, unknown>);
      }
    }
    if (Array.isArray(result.metrics)) {
      for (const metricEntry of result.metrics) {
        if (metricEntry && typeof metricEntry === 'object') {
          candidates.push(metricEntry as Record<string, unknown>);
        }
      }
    }
  }

  if (Array.isArray(job.metrics)) {
    for (const item of job.metrics as unknown[]) {
      if (item && typeof item === 'object') {
        candidates.push(item as Record<string, unknown>);
      }
    }
  } else if (job.metrics && typeof job.metrics === 'object') {
    candidates.push(job.metrics as Record<string, unknown>);
  }

  const keys = {
    allowlistedCitationPrecisionP95: [
      'allowlisted_citation_precision_p95',
      'citation_precision_p95',
      'allowlist_precision_p95',
    ],
    temporalValidityP95: ['temporal_validity_p95', 'temporal_validity'],
    maghrebBannerCoverage: ['maghreb_banner_coverage', 'maghreb_banner_ratio'],
    hitlRecallHighRisk: ['hitl_recall_high_risk', 'hitl_high_risk_recall'],
  };

  const metrics: EvalJobMetrics = {
    allowlistedCitationPrecisionP95: null,
    temporalValidityP95: null,
    maghrebBannerCoverage: null,
    hitlRecallHighRisk: null,
  };

  for (const candidate of candidates) {
    metrics.allowlistedCitationPrecisionP95 ??= metricFromCandidate(candidate, keys.allowlistedCitationPrecisionP95);
    metrics.temporalValidityP95 ??= metricFromCandidate(candidate, keys.temporalValidityP95);
    metrics.maghrebBannerCoverage ??= metricFromCandidate(candidate, keys.maghrebBannerCoverage);
    metrics.hitlRecallHighRisk ??= metricFromCandidate(candidate, keys.hitlRecallHighRisk);
  }

  return metrics;
}

function extractError(job: RawEvalJob): string | null {
  if (!job.error) {
    return null;
  }
  if (typeof job.error === 'string') {
    return job.error;
  }
  if (job.error && typeof job.error === 'object') {
    const maybeMessage = (job.error as Record<string, unknown>).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }
    return JSON.stringify(job.error);
  }
  return String(job.error);
}

function buildBaseUrl(baseUrl?: string): string {
  const source = baseUrl ?? serverEnv.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  return source.endsWith('/evals') ? source : `${source.replace(/\/$/, '')}/evals`;
}

export class OpenAIEvalsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly requestTags?: string;

  constructor(config?: Partial<OpenAIEvalsClientConfig>) {
    const apiKey = config?.apiKey ?? serverEnv.OPENAI_API_KEY;
    assertApiKey(apiKey);
    this.apiKey = apiKey;
    this.baseUrl = buildBaseUrl(config?.baseUrl);
    this.requestTags = config?.requestTags ?? serverEnv.OPENAI_REQUEST_TAGS_OPS ?? serverEnv.OPENAI_REQUEST_TAGS;
  }

  private async request<TResponse = JsonRecord>(
    path: string,
    init: RequestInit & { method: 'GET' | 'POST' },
  ): Promise<TResponse> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.requestTags && this.requestTags.length > 0) {
      headers['OpenAI-Request-Tags'] = this.requestTags;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI eval request failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return {} as TResponse;
    }

    return (await response.json()) as TResponse;
  }

  async createJob(options: CreateEvalJobOptions): Promise<EvalJobResult> {
    if (!options.datasetId) {
      throw new Error('datasetId is required to create an eval job');
    }
    if (!options.agentId) {
      throw new Error('agentId is required to create an eval job');
    }

    const body: JsonRecord = {
      dataset_id: options.datasetId,
      agent_id: options.agentId,
    };

    if (options.metadata) {
      body.metadata = options.metadata;
    }
    if (options.tags && options.tags.length > 0) {
      body.tags = options.tags;
    }
    if (options.runName) {
      body.run_name = options.runName;
    }

    const rawJob = await this.request<RawEvalJob>('', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return this.normaliseJob(rawJob);
  }

  async retrieveJob(jobId: string): Promise<EvalJobResult> {
    if (!jobId || jobId.length === 0) {
      throw new Error('jobId is required to retrieve an eval job');
    }
    const rawJob = await this.request<RawEvalJob>(`/${jobId}`, { method: 'GET' });
    return this.normaliseJob(rawJob);
  }

  async pollJob(jobId: string, options?: PollEvalJobOptions): Promise<EvalJobResult> {
    const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startedAt = Date.now();

    while (true) {
      const job = await this.retrieveJob(jobId);
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return job;
      }
      if (Date.now() - startedAt > timeout) {
        throw new Error(`Eval job ${jobId} timed out after ${(timeout / 1_000).toFixed(0)}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  private normaliseJob(job: RawEvalJob): EvalJobResult {
    const status = normaliseStatus(job.status);
    const metrics = extractMetrics(job);
    const metadata = (job.metadata && typeof job.metadata === 'object' ? job.metadata : {}) as JsonRecord;
    return {
      id: typeof job.id === 'string' ? job.id : 'unknown',
      status,
      error: extractError(job),
      metrics,
      metadata,
      datasetId: typeof job.dataset_id === 'string' ? job.dataset_id : null,
      agentId: typeof job.agent_id === 'string' ? job.agent_id : null,
      raw: job as JsonRecord,
    };
  }
}

export function createOpenAIEvalsClient(config?: Partial<OpenAIEvalsClientConfig>): OpenAIEvalsClient {
  return new OpenAIEvalsClient(config);
}
