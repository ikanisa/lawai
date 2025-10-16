import {
  CorpusDashboardDataSchema,
  PolicyConfigurationSchema,
  type CorpusDashboardData,
  type PolicyConfiguration,
} from '@avocat-ai/shared';

const corpusDashboardData = CorpusDashboardDataSchema.parse({
  allowlist: [
    {
      id: 'legifrance',
      name: 'Légifrance — Codes consolidés',
      jurisdiction: 'FR',
      enabled: true,
      lastIndexed: '2024-05-27T09:12:00Z',
      type: 'official',
    },
    {
      id: 'ohada_official',
      name: 'OHADA — Actes uniformes',
      jurisdiction: 'OHADA',
      enabled: true,
      lastIndexed: '2024-05-26T18:45:00Z',
      type: 'official',
    },
    {
      id: 'ohada_gazette',
      name: 'Journal Officiel OHADA',
      jurisdiction: 'OHADA',
      enabled: false,
      lastIndexed: '2024-05-10T07:00:00Z',
      type: 'secondary',
    },
    {
      id: 'drive_internal',
      name: 'Google Drive — Banque Helios',
      jurisdiction: 'FR',
      enabled: true,
      lastIndexed: '2024-05-28T05:20:00Z',
      type: 'internal',
    },
  ],
  integrations: [
    {
      id: 'supabase-vector',
      name: 'Vector Store — Supabase',
      provider: 'Supabase',
      status: 'connected',
      lastSync: '2024-05-27T23:10:00Z',
    },
    {
      id: 'drive-watch',
      name: 'Google Drive Watcher',
      provider: 'Google',
      status: 'syncing',
      message: 'Processus delta en cours sur 14 fichiers.',
    },
    {
      id: 'ohada-fetcher',
      name: 'OHADA Web Search',
      provider: 'SerpAPI',
      status: 'error',
      message: 'Quota dépassé — réessayer après 01:00 UTC.',
      lastSync: '2024-05-27T02:30:00Z',
    },
  ],
  snapshots: [
    {
      id: 'snapshot_may',
      label: 'Snapshot légal — Mai 2024',
      createdAt: '2024-05-25T21:00:00Z',
      author: 'Equipe Knowledge',
      sizeMb: 4_096,
    },
    {
      id: 'snapshot_ohada_q1',
      label: 'Corpus OHADA — T1 2024',
      createdAt: '2024-04-04T11:30:00Z',
      author: 'Avocat-AI Pipeline',
      sizeMb: 1_536,
    },
  ],
  ingestionJobs: [
    {
      id: 'job_ohada_apr',
      filename: 'ohada_uniform_act_2024-04-18.pdf',
      status: 'processing',
      submittedAt: '2024-05-27T07:10:00Z',
      jurisdiction: 'OHADA',
      progress: 58,
      note: 'Extraction Akoma Ntoso en cours.',
    },
    {
      id: 'job_ccja_audio',
      filename: 'ccja_audience_2024-05-12.mp3',
      status: 'failed',
      submittedAt: '2024-05-26T19:45:00Z',
      jurisdiction: 'OHADA',
      progress: 20,
      note: 'Transcription vocale à relancer (erreur 500).',
    },
    {
      id: 'job_legifrance',
      filename: 'legifrance_codes_2024-05-20.zip',
      status: 'ready',
      submittedAt: '2024-05-21T08:00:00Z',
      jurisdiction: 'FR',
      progress: 100,
    },
  ],
});

const policyConfiguration = PolicyConfigurationSchema.parse({
  statute_first: true,
  ohada_preemption_priority: true,
  binding_language_guardrail: true,
  sensitive_topic_hitl: true,
  confidential_mode: false,
});

export interface CorpusDashboardResponse extends CorpusDashboardData {
  policies: PolicyConfiguration;
}

export const CorpusDashboardResponseSchema = CorpusDashboardDataSchema.extend({
  policies: PolicyConfigurationSchema,
});

const response = CorpusDashboardResponseSchema.parse({
  ...corpusDashboardData,
  policies: policyConfiguration,
});

export function cloneCorpusDashboardResponse(): CorpusDashboardResponse {
  return JSON.parse(JSON.stringify(response)) as CorpusDashboardResponse;
}
