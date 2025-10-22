import { z } from 'zod';

export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'requires_hitl',
]);

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z
  .object({
    id: z.string(),
    agentId: z.string(),
    threadId: z.string(),
    status: AgentRunStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    input: z.string(),
    jurisdiction: z.string().nullable().default(null),
    policyFlags: z.array(z.string()).default([]),
  })
  .strict();

export type AgentRun = z.infer<typeof AgentRunSchema>;

export const ToolEventSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['running', 'success', 'error']),
    detail: z.string(),
    planStepId: z.string().optional().nullable(),
    startedAt: z.string(),
    completedAt: z.string().optional().nullable(),
  })
  .strict();

export type ToolEvent = z.infer<typeof ToolEventSchema>;

export const AgentRunRequestSchema = z
  .object({
    input: z.string().min(1),
    agent_id: z.string(),
    tools_enabled: z.array(z.string()).default([]),
    jurisdiction: z.string().optional().nullable(),
    policy_flags: z.array(z.string()).default([]),
  })
  .strict();

export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

export const AgentStreamRequestSchema = z
  .object({
    input: z.string().min(1),
    agent_id: z.string(),
    run_id: z.string(),
    thread_id: z.string(),
    tools_enabled: z.array(z.string()).default([]),
  })
  .strict();

export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;

export const VoiceSessionTokenSchema = z
  .object({
    token: z.string(),
    expires_at: z.string(),
    websocket_url: z.string().url().optional(),
    webrtc_url: z.string().url().optional(),
  })
  .strict();

export type VoiceSessionToken = z.infer<typeof VoiceSessionTokenSchema>;

export const ResearchRiskLevelSchema = z.enum(['LOW', 'MED', 'HIGH']);
export type ResearchRiskLevel = z.infer<typeof ResearchRiskLevelSchema>;

export const ResearchPlanStepSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    tool: z.string(),
    status: z.enum(['done', 'active', 'pending']),
    summary: z.string(),
  })
  .strict();

export type ResearchPlanStep = z.infer<typeof ResearchPlanStepSchema>;

export const ResearchPlanSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    jurisdiction: z.string(),
    riskLevel: ResearchRiskLevelSchema,
    riskSummary: z.string(),
    steps: z.array(ResearchPlanStepSchema),
  })
  .strict();

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;

export const ResearchFilterOptionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })
  .strict();

export type ResearchFilterOption = z.infer<typeof ResearchFilterOptionSchema>;

export const ResearchCitationSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    href: z.string().url(),
    type: z.enum(['Officiel', 'Consolidé', 'Traduction', 'Jurisprudence']),
    snippet: z.string(),
    score: z.number().min(0).max(100),
    date: z.string(),
  })
  .strict();

export type ResearchCitation = z.infer<typeof ResearchCitationSchema>;

export const ResearchDeskContextSchema = z
  .object({
    plan: ResearchPlanSchema,
    filters: z.object({
      publicationDates: z.array(ResearchFilterOptionSchema),
      entryIntoForce: z.array(ResearchFilterOptionSchema),
    }),
    defaultCitations: z.array(ResearchCitationSchema),
    suggestions: z.array(z.string()),
  })
  .strict();

export type ResearchDeskContext = z.infer<typeof ResearchDeskContextSchema>;

export const ResearchStreamPayloadSchema = z
  .object({
    token: z.string().optional(),
    tool: z
      .object({
        id: z.string(),
        name: z.string(),
        status: z.enum(['running', 'success', 'error']),
        detail: z.string(),
        planStepId: z.string().optional().nullable(),
      })
      .optional(),
    citation: ResearchCitationSchema.optional(),
    risk: z
      .object({
        level: ResearchRiskLevelSchema,
        summary: z.string(),
      })
      .optional(),
  })
  .strict();

export type ResearchStreamPayload = z.infer<typeof ResearchStreamPayloadSchema>;

export type ResearchStreamMessageType = 'token' | 'tool' | 'citation' | 'risk' | 'done';

export interface ResearchStreamEvent {
  type: ResearchStreamMessageType;
  data: ResearchStreamPayload;
}

export const CitationTypeSchema = z.enum(['statute', 'regulation', 'case', 'doctrine']);
export type CitationType = z.infer<typeof CitationTypeSchema>;

export const CitationVersionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    publishedAt: z.string(),
    isConsolidated: z.boolean(),
    diffSummary: z.string(),
  })
  .strict();

export type CitationVersion = z.infer<typeof CitationVersionSchema>;

export const CitationDocumentSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    eli: z.string(),
    jurisdiction: z.string(),
    type: CitationTypeSchema,
    publicationDate: z.string(),
    entryIntoForce: z.string(),
    badges: z.array(z.enum(['Officiel', 'Consolidé', 'Traduction', 'Jurisprudence'])),
    summary: z.string(),
    toc: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        anchor: z.string(),
      }),
    ),
    versions: z.array(CitationVersionSchema),
    metadata: z.record(z.string()),
    content: z.array(
      z.object({
        anchor: z.string(),
        heading: z.string(),
        text: z.string(),
      }),
    ),
  })
  .strict();

export type CitationDocument = z.infer<typeof CitationDocumentSchema>;

export const CitationsBrowserDataSchema = z
  .object({
    results: z.array(CitationDocumentSchema),
    ohadaFeatured: z.array(CitationDocumentSchema),
  })
  .strict();

export type CitationsBrowserData = z.infer<typeof CitationsBrowserDataSchema>;

export const MatterRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type MatterRiskLevel = z.infer<typeof MatterRiskLevelSchema>;

export const MatterTimelineEventSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    occurredAt: z.string(),
    actor: z.string(),
    summary: z.string(),
  })
  .strict();

export type MatterTimelineEvent = z.infer<typeof MatterTimelineEventSchema>;

export const MatterDeadlineEntrySchema = z
  .object({
    id: z.string(),
    label: z.string(),
    dueAt: z.string(),
    status: z.enum(['upcoming', 'urgent', 'passed']),
    jurisdiction: z.string(),
    note: z.string(),
  })
  .strict();

export type MatterDeadlineEntry = z.infer<typeof MatterDeadlineEntrySchema>;

export const MatterDocumentNodeSchema: z.ZodType<{
  id: string;
  title: string;
  kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
  citeCheck: 'clean' | 'issues' | 'pending';
  updatedAt: string;
  author: string;
  children?: any;
}> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(['pleading', 'evidence', 'correspondence', 'analysis', 'order']),
      citeCheck: z.enum(['clean', 'issues', 'pending']),
      updatedAt: z.string(),
      author: z.string(),
      children: z.array(MatterDocumentNodeSchema).optional(),
    })
    .strict(),
);

export type MatterDocumentNode = z.infer<typeof MatterDocumentNodeSchema>;

export const MatterSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    client: z.string(),
    opposing: z.string(),
    governingLaw: z.string(),
    riskLevel: MatterRiskLevelSchema,
    stage: z.string(),
    nextHearing: z.string(),
    principalIssue: z.string(),
    documents: z.array(MatterDocumentNodeSchema),
    deadlines: z.array(MatterDeadlineEntrySchema),
    timeline: z.array(MatterTimelineEventSchema),
  })
  .strict();

export type MatterSummary = z.infer<typeof MatterSummarySchema>;

export const MattersOverviewSchema = z
  .object({
    matters: z.array(MatterSummarySchema),
  })
  .strict();

export type MattersOverview = z.infer<typeof MattersOverviewSchema>;

export const HitlRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type HitlRiskLevel = z.infer<typeof HitlRiskLevelSchema>;

export const HitlOutcomeSchema = z.enum(['approved', 'changes_requested', 'rejected']);
export type HitlOutcome = z.infer<typeof HitlOutcomeSchema>;

export const HitlEvidenceReferenceSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    uri: z.string(),
    type: z.enum(['statute', 'case', 'regulation', 'doctrine']),
  })
  .strict();

export type HitlEvidenceReference = z.infer<typeof HitlEvidenceReferenceSchema>;

export const HitlIracBlockSchema = z
  .object({
    issue: z.string(),
    rules: z.array(z.string()),
    application: z.string(),
    conclusion: z.string(),
  })
  .strict();

export type HitlIracBlock = z.infer<typeof HitlIracBlockSchema>;

export const HitlReviewItemSchema = z
  .object({
    id: z.string(),
    submittedAt: z.string(),
    matter: z.string(),
    agent: z.string(),
    locale: z.string(),
    riskLevel: HitlRiskLevelSchema,
    requiresTranslationCheck: z.boolean(),
    litigationType: z.enum(['civil', 'commercial', 'labor', 'administrative']),
    summary: z.string(),
    irac: HitlIracBlockSchema,
    evidence: z.array(HitlEvidenceReferenceSchema),
    deltas: z.array(z.string()),
  })
  .strict();

export type HitlReviewItem = z.infer<typeof HitlReviewItemSchema>;

export const HitlQueueDataSchema = z
  .object({
    queue: z.array(HitlReviewItemSchema),
  })
  .strict();

export type HitlQueueData = z.infer<typeof HitlQueueDataSchema>;

export const AllowlistSourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    jurisdiction: z.string(),
    enabled: z.boolean(),
    lastIndexed: z.string(),
    type: z.enum(['official', 'secondary', 'internal']),
  })
  .strict();

export type AllowlistSource = z.infer<typeof AllowlistSourceSchema>;

export const IntegrationStatusSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    status: z.enum(['connected', 'error', 'syncing', 'disconnected']),
    lastSync: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const SnapshotEntrySchema = z
  .object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
    author: z.string(),
    sizeMb: z.number(),
  })
  .strict();

export type SnapshotEntry = z.infer<typeof SnapshotEntrySchema>;

export const IngestionJobSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    status: z.enum(['processing', 'failed', 'ready']),
    submittedAt: z.string(),
    jurisdiction: z.string(),
    progress: z.number().min(0).max(100),
    note: z.string().optional(),
  })
  .strict();

export type IngestionJob = z.infer<typeof IngestionJobSchema>;

export const CorpusDashboardDataSchema = z
  .object({
    allowlist: z.array(AllowlistSourceSchema),
    integrations: z.array(IntegrationStatusSchema),
    snapshots: z.array(SnapshotEntrySchema),
    ingestionJobs: z.array(IngestionJobSchema),
  })
  .strict();

export type CorpusDashboardData = z.infer<typeof CorpusDashboardDataSchema>;

export const PolicyConfigurationSchema = z
  .object({
    statute_first: z.boolean(),
    ohada_preemption_priority: z.boolean(),
    binding_language_guardrail: z.boolean(),
    sensitive_topic_hitl: z.boolean(),
    confidential_mode: z.boolean(),
  })
  .strict();

export type PolicyConfiguration = z.infer<typeof PolicyConfigurationSchema>;

export const UploadResponseSchema = z
  .object({
    uploadId: z.string(),
    status: z.enum(['queued', 'processing', 'indexed']),
    receivedAt: z.string(),
  })
  .strict();

export type UploadResponse = z.infer<typeof UploadResponseSchema>;

export const VoiceToolIntentStatusSchema = z.enum([
  'scheduled',
  'running',
  'completed',
  'requires_hitl',
]);

export type VoiceToolIntentStatus = z.infer<typeof VoiceToolIntentStatusSchema>;

export const VoiceToolIntentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tool: z.string(),
    status: VoiceToolIntentStatusSchema,
    detail: z.string(),
  })
  .strict();

export type VoiceToolIntent = z.infer<typeof VoiceToolIntentSchema>;

export const VoiceSessionIntentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tool: z.string(),
    status: VoiceToolIntentStatusSchema.optional(),
  })
  .strict();

export type VoiceSessionIntent = z.infer<typeof VoiceSessionIntentSchema>;

export const VoiceCitationSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    href: z.string().url(),
    snippet: z.string(),
  })
  .strict();

export type VoiceCitation = z.infer<typeof VoiceCitationSchema>;

export const VoiceSessionSummarySchema = z
  .object({
    id: z.string(),
    startedAt: z.string(),
    durationMs: z.number(),
    transcript: z.string(),
    summary: z.string(),
    citations: z.array(VoiceCitationSchema),
    intents: z.array(VoiceSessionIntentSchema),
  })
  .strict();

export type VoiceSessionSummary = z.infer<typeof VoiceSessionSummarySchema>;

export const VoiceConsoleContextSchema = z
  .object({
    suggestions: z.array(z.string()),
    quickIntents: z.array(VoiceToolIntentSchema),
    recentSessions: z.array(VoiceSessionSummarySchema),
    guardrails: z.array(z.string()),
  })
  .strict();

export type VoiceConsoleContext = z.infer<typeof VoiceConsoleContextSchema>;

export const VoiceRunRequestSchema = z
  .object({
    agent_id: z.string(),
    locale: z.string(),
    transcript: z.string().min(1),
    intents: z.array(z.string()).default([]),
    citations: z.array(z.string()).default([]),
  })
  .strict();

export type VoiceRunRequest = z.infer<typeof VoiceRunRequestSchema>;

export const VoiceRunResponseSchema = z
  .object({
    id: z.string(),
    summary: z.string(),
    followUps: z.array(z.string()),
    citations: z.array(VoiceCitationSchema),
    intents: z.array(VoiceToolIntentSchema),
    readback: z.array(z.string()),
    riskLevel: ResearchRiskLevelSchema.default('LOW'),
    clarifications: z.array(z.string()).default([]),
  })
  .strict();

export type VoiceRunResponse = z.infer<typeof VoiceRunResponseSchema>;
