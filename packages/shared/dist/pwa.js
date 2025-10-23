import { z } from 'zod';
export const AgentRunStatusSchema = z.enum([
    'queued',
    'running',
    'succeeded',
    'failed',
    'requires_hitl',
]);
export const WebSearchModeSchema = z.enum(['disabled', 'allowlist', 'broad']);
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
    webSearchMode: WebSearchModeSchema.default('allowlist'),
})
    .strict();
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
export const AgentRunRequestSchema = z
    .object({
    input: z.string().min(1),
    agent_id: z.string(),
    tools_enabled: z.array(z.string()).default([]),
    jurisdiction: z.string().optional().nullable(),
    policy_flags: z.array(z.string()).default([]),
    web_search_mode: WebSearchModeSchema.default('allowlist'),
})
    .strict();
export const AgentStreamRequestSchema = z
    .object({
    input: z.string().min(1),
    agent_id: z.string(),
    run_id: z.string(),
    thread_id: z.string(),
    tools_enabled: z.array(z.string()).default([]),
    web_search_mode: WebSearchModeSchema.default('allowlist'),
})
    .strict();
export const VoiceSessionTokenSchema = z
    .object({
    token: z.string(),
    expires_at: z.string(),
    websocket_url: z.string().url().optional(),
    webrtc_url: z.string().url().optional(),
})
    .strict();
export const ResearchRiskLevelSchema = z.enum(['LOW', 'MED', 'HIGH']);
export const ResearchPlanStepSchema = z
    .object({
    id: z.string(),
    title: z.string(),
    tool: z.string(),
    status: z.enum(['done', 'active', 'pending']),
    summary: z.string(),
})
    .strict();
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
export const ResearchFilterOptionSchema = z
    .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
})
    .strict();
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
export const CitationTypeSchema = z.enum(['statute', 'regulation', 'case', 'doctrine']);
export const CitationVersionSchema = z
    .object({
    id: z.string(),
    label: z.string(),
    publishedAt: z.string(),
    isConsolidated: z.boolean(),
    diffSummary: z.string(),
})
    .strict();
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
    toc: z.array(z.object({
        id: z.string(),
        label: z.string(),
        anchor: z.string(),
    })),
    versions: z.array(CitationVersionSchema),
    metadata: z.record(z.string()),
    content: z.array(z.object({
        anchor: z.string(),
        heading: z.string(),
        text: z.string(),
    })),
})
    .strict();
export const CitationsBrowserDataSchema = z
    .object({
    results: z.array(CitationDocumentSchema),
    ohadaFeatured: z.array(CitationDocumentSchema),
})
    .strict();
export const MatterRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const MatterTimelineEventSchema = z
    .object({
    id: z.string(),
    label: z.string(),
    occurredAt: z.string(),
    actor: z.string(),
    summary: z.string(),
})
    .strict();
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
export const MatterDocumentNodeSchema = z.lazy(() => z
    .object({
    id: z.string(),
    title: z.string(),
    kind: z.enum(['pleading', 'evidence', 'correspondence', 'analysis', 'order']),
    citeCheck: z.enum(['clean', 'issues', 'pending']),
    updatedAt: z.string(),
    author: z.string(),
    children: z.array(MatterDocumentNodeSchema).optional(),
})
    .strict());
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
export const MattersOverviewSchema = z
    .object({
    matters: z.array(MatterSummarySchema),
})
    .strict();
export const HitlRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const HitlOutcomeSchema = z.enum(['approved', 'changes_requested', 'rejected']);
export const HitlEvidenceReferenceSchema = z
    .object({
    id: z.string(),
    label: z.string(),
    uri: z.string(),
    type: z.enum(['statute', 'case', 'regulation', 'doctrine']),
})
    .strict();
export const HitlIracBlockSchema = z
    .object({
    issue: z.string(),
    rules: z.array(z.string()),
    application: z.string(),
    conclusion: z.string(),
})
    .strict();
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
export const HitlQueueDataSchema = z
    .object({
    queue: z.array(HitlReviewItemSchema),
})
    .strict();
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
export const SnapshotEntrySchema = z
    .object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
    author: z.string(),
    sizeMb: z.number(),
})
    .strict();
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
export const CorpusDashboardDataSchema = z
    .object({
    allowlist: z.array(AllowlistSourceSchema),
    integrations: z.array(IntegrationStatusSchema),
    snapshots: z.array(SnapshotEntrySchema),
    ingestionJobs: z.array(IngestionJobSchema),
})
    .strict();
export const PolicyConfigurationSchema = z
    .object({
    statute_first: z.boolean(),
    ohada_preemption_priority: z.boolean(),
    binding_language_guardrail: z.boolean(),
    sensitive_topic_hitl: z.boolean(),
    confidential_mode: z.boolean(),
})
    .strict();
export const UploadResponseSchema = z
    .object({
    uploadId: z.string(),
    status: z.enum(['queued', 'processing', 'indexed']),
    receivedAt: z.string(),
})
    .strict();
export const VoiceToolIntentStatusSchema = z.enum([
    'scheduled',
    'running',
    'completed',
    'requires_hitl',
]);
export const VoiceToolIntentSchema = z
    .object({
    id: z.string(),
    name: z.string(),
    tool: z.string(),
    status: VoiceToolIntentStatusSchema,
    detail: z.string(),
})
    .strict();
export const VoiceCitationSchema = z
    .object({
    id: z.string(),
    label: z.string(),
    href: z.string().url(),
    snippet: z.string(),
})
    .strict();
export const VoiceSessionSummarySchema = z
    .object({
    id: z.string(),
    startedAt: z.string(),
    durationMs: z.number(),
    transcript: z.string(),
    summary: z.string(),
    citations: z.array(VoiceCitationSchema),
    intents: z.array(z.object({
        id: z.string(),
        name: z.string(),
        tool: z.string(),
    })),
})
    .strict();
export const VoiceConsoleContextSchema = z
    .object({
    suggestions: z.array(z.string()),
    quickIntents: z.array(VoiceToolIntentSchema),
    recentSessions: z.array(VoiceSessionSummarySchema),
    guardrails: z.array(z.string()),
})
    .strict();
export const VoiceRunRequestSchema = z
    .object({
    agent_id: z.string(),
    locale: z.string(),
    transcript: z.string().min(1),
    intents: z.array(z.string()).default([]),
    citations: z.array(z.string()).default([]),
})
    .strict();
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
