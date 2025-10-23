import { DEFAULT_WEB_SEARCH_ALLOWLIST_MAX } from '@avocat-ai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validPayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: "Validité d'une clause",
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      binding: true,
      effective_date: '2016-10-01',
    },
  ],
  application: 'Analyse structurée',
  conclusion: 'La clause est valable sous conditions.',
  citations: [
    {
      title: 'Code civil',
      court_or_publisher: 'Légifrance',
      date: '2016-10-01',
      url: 'https://legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      note: 'consolidé',
    },
  ],
  risk: {
    level: 'LOW',
    why: 'Analyse standard',
    hitl_required: false,
  },
};

const runInsertSingleMock = vi.fn(async () => ({ data: { id: 'run-1' }, error: null }));
const runInsertSelectMock = vi.fn(() => ({ single: runInsertSingleMock }));
const runInsertMock = vi.fn(() => ({ select: runInsertSelectMock }));

const agentRunsSelectBuilder: any = {};
agentRunsSelectBuilder.select = vi.fn(() => agentRunsSelectBuilder);
agentRunsSelectBuilder.eq = vi.fn(() => agentRunsSelectBuilder);
agentRunsSelectBuilder.order = vi.fn(() => agentRunsSelectBuilder);
agentRunsSelectBuilder.limit = vi.fn(() => agentRunsSelectBuilder);
agentRunsSelectBuilder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));

const agentRunsTableSelect = vi.fn(() => agentRunsSelectBuilder);
const agentRunsUpdateMock = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }));

const citationsInsertMock = vi.fn(async () => ({ error: null }));
const toolInsertMock = vi.fn(async () => ({ error: null }));
const retrievalInsertMock = vi.fn(async () => ({ error: null }));
const hitlInsertMock = vi.fn(async () => ({ error: null }));
const telemetryInsertMock = vi.fn(async () => ({ error: null }));
const learningInsertMock = vi.fn(async () => ({ error: null }));
const auditInsertMock = vi.fn(async () => ({ error: null }));
const caseScoresInsertMock = vi.fn(async () => ({ error: null }));
const supabaseRpcMock = vi.fn(async () => ({ data: [], error: null }));

function createAsyncQuery(initialData: unknown[] = [], initialError: unknown = null) {
  const builder: any = {
    __response: { data: initialData, error: initialError },
    setResponse(data: unknown, error: unknown = null) {
      builder.__response = { data, error };
      return builder;
    },
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(builder.__response)),
    or: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(builder.__response)),
  };
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    resolve(builder.__response);
  return builder;
}

const toolInvocationsSelectBuilder: any = {};
toolInvocationsSelectBuilder.eq = vi.fn(() => toolInvocationsSelectBuilder);
toolInvocationsSelectBuilder.order = vi.fn(async () => ({ data: [], error: null }));
const toolInvocationsTableSelect = vi.fn(() => toolInvocationsSelectBuilder);
const runRetrievalSelectBuilder = createAsyncQuery();
const sourcesQuery = createAsyncQuery();
const caseScoresQuery = createAsyncQuery();
const hitlQueueQuery = createAsyncQuery();
const synonymsQuery = createAsyncQuery();
const policyVersionsQuery = createAsyncQuery();

const templateRows = [
  {
    id: 'tpl-fr',
    org_id: null,
    jurisdiction_code: 'FR',
    matter_type: 'assignation',
    title: 'Assignation civile',
    summary: 'Modèle FR',
    sections: [{ heading: 'Faits', body: 'Décrire les faits.' }],
    fill_ins: ['Parties'],
    locale: 'fr',
  },
];

const templateQuery = {
  select: vi.fn(() => templateQuery),
  in: vi.fn(() => templateQuery),
  eq: vi.fn(() => templateQuery),
  or: vi.fn(() => templateQuery),
  order: vi.fn(() => templateQuery),
  then: (resolve: (value: unknown) => unknown) => resolve({ data: templateRows, error: null }),
};

async function importAgentModule() {
  vi.resetModules();
  return import('../src/agent.js');
}

const complianceAssessmentsQuery = createAsyncQuery();
complianceAssessmentsQuery.setResponse(null, null);

const defaultAccessContext = {
  orgId: '00000000-0000-0000-0000-000000000000',
  userId: '00000000-0000-0000-0000-000000000000',
  role: 'owner' as const,
  policies: {
    confidentialMode: false,
    franceJudgeAnalyticsBlocked: true,
    mfaRequired: false,
    ipAllowlistEnforced: false,
    consentRequirement: null,
    councilOfEuropeRequirement: null,
  },
  rawPolicies: {},
  entitlements: new Map<string, { canRead: boolean; canWrite: boolean }>([
    ['FR', { canRead: true, canWrite: true }],
    ['EU', { canRead: true, canWrite: false }],
    ['OHADA', { canRead: true, canWrite: false }],
    ['MAGHREB', { canRead: true, canWrite: false }],
    ['RW', { canRead: true, canWrite: false }],
  ]),
  ipAllowlistCidrs: [],
  consent: { requirement: null, latest: null },
  councilOfEurope: { requirement: null, acknowledgedVersion: null },
};

function makeContext(
  overrides: Partial<typeof defaultAccessContext> = {},
): typeof defaultAccessContext {
  return {
    ...defaultAccessContext,
    ...overrides,
    entitlements: overrides.entitlements
      ? new Map(overrides.entitlements)
      : new Map(defaultAccessContext.entitlements),
    policies: {
      ...defaultAccessContext.policies,
      ...(overrides.policies ?? {}),
    },
    consent: {
      ...defaultAccessContext.consent,
      ...(overrides.consent ?? {}),
    },
    councilOfEurope: {
      ...defaultAccessContext.councilOfEurope,
      ...(overrides.councilOfEurope ?? {}),
    },
  };
}

const runMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  runMock.mockReset();
  runInsertMock.mockClear();
  runInsertSelectMock.mockClear();
  runInsertSingleMock.mockClear();
  agentRunsSelectBuilder.select.mockClear();
  agentRunsSelectBuilder.eq.mockClear();
  agentRunsSelectBuilder.order.mockClear();
  agentRunsSelectBuilder.limit.mockClear();
  agentRunsSelectBuilder.maybeSingle.mockClear();
  toolInvocationsSelectBuilder.eq.mockClear();
  toolInvocationsSelectBuilder.order.mockClear();
  runRetrievalSelectBuilder.select.mockClear();
  runRetrievalSelectBuilder.eq.mockClear();
  runRetrievalSelectBuilder.in.mockClear();
  runRetrievalSelectBuilder.ilike.mockClear();
  runRetrievalSelectBuilder.order.mockClear();
  caseScoresQuery.select.mockClear();
  caseScoresQuery.eq.mockClear();
  caseScoresQuery.in.mockClear();
  caseScoresQuery.ilike.mockClear();
  caseScoresQuery.order.mockClear();
  hitlQueueQuery.select.mockClear();
  hitlQueueQuery.eq.mockClear();
  synonymsQuery.select.mockClear();
  synonymsQuery.in.mockClear();
  synonymsQuery.order.mockClear();
  policyVersionsQuery.select.mockClear();
  policyVersionsQuery.not = policyVersionsQuery.not ?? vi.fn(() => policyVersionsQuery);
  policyVersionsQuery.order.mockClear();
  policyVersionsQuery.limit.mockClear();
  sourcesQuery.select.mockClear();
  sourcesQuery.eq.mockClear();
  sourcesQuery.in.mockClear();
  sourcesQuery.ilike.mockClear();
  sourcesQuery.order.mockClear();
  complianceAssessmentsQuery.select.mockClear();
  complianceAssessmentsQuery.eq.mockClear();
  complianceAssessmentsQuery.order.mockClear();
  complianceAssessmentsQuery.limit.mockClear();
  complianceAssessmentsQuery.maybeSingle.mockClear();
  complianceAssessmentsQuery.setResponse(null, null);
  agentRunsSelectBuilder.select.mockImplementation(() => agentRunsSelectBuilder);
  agentRunsSelectBuilder.eq.mockImplementation(() => agentRunsSelectBuilder);
  agentRunsSelectBuilder.order.mockImplementation(() => agentRunsSelectBuilder);
  agentRunsSelectBuilder.limit.mockImplementation(() => agentRunsSelectBuilder);
  agentRunsSelectBuilder.maybeSingle.mockImplementation(async () => ({ data: null, error: null }));
  toolInvocationsSelectBuilder.eq.mockImplementation(() => toolInvocationsSelectBuilder);
  toolInvocationsSelectBuilder.order.mockImplementation(async () => ({ data: [], error: null }));
  runRetrievalSelectBuilder.select.mockImplementation(() => runRetrievalSelectBuilder);
  runRetrievalSelectBuilder.eq.mockImplementation(() => runRetrievalSelectBuilder);
  runRetrievalSelectBuilder.in.mockImplementation(() => runRetrievalSelectBuilder);
  runRetrievalSelectBuilder.ilike.mockImplementation(() => runRetrievalSelectBuilder);
  runRetrievalSelectBuilder.order.mockImplementation(() => runRetrievalSelectBuilder);
  caseScoresQuery.select.mockImplementation(() => caseScoresQuery);
  caseScoresQuery.eq.mockImplementation(() => caseScoresQuery);
  caseScoresQuery.in.mockImplementation(() => caseScoresQuery);
  caseScoresQuery.ilike.mockImplementation(() => caseScoresQuery);
  caseScoresQuery.order.mockImplementation(() => caseScoresQuery);
  sourcesQuery.select.mockImplementation(() => sourcesQuery);
  sourcesQuery.eq.mockImplementation(() => sourcesQuery);
  sourcesQuery.in.mockImplementation(() => sourcesQuery);
  sourcesQuery.ilike.mockImplementation(() => sourcesQuery);
  sourcesQuery.order.mockImplementation(() => sourcesQuery);
  complianceAssessmentsQuery.select.mockImplementation(() => complianceAssessmentsQuery);
  complianceAssessmentsQuery.eq.mockImplementation(() => complianceAssessmentsQuery);
  complianceAssessmentsQuery.order.mockImplementation(() => complianceAssessmentsQuery);
  complianceAssessmentsQuery.limit.mockImplementation(() => complianceAssessmentsQuery);
  synonymsQuery.select.mockImplementation(() => synonymsQuery);
  synonymsQuery.in.mockImplementation(() => synonymsQuery);
  synonymsQuery.order.mockImplementation(() => synonymsQuery);
  policyVersionsQuery.select.mockImplementation(() => policyVersionsQuery);
  policyVersionsQuery.not = vi.fn(() => policyVersionsQuery);
  policyVersionsQuery.order.mockImplementation(() => policyVersionsQuery);
  policyVersionsQuery.limit.mockImplementation(() => policyVersionsQuery);
  synonymsQuery.setResponse([], null);
  policyVersionsQuery.setResponse([], null);
  citationsInsertMock.mockClear();
  toolInsertMock.mockClear();
  retrievalInsertMock.mockClear();
  hitlInsertMock.mockClear();
  telemetryInsertMock.mockClear();
  learningInsertMock.mockClear();
  auditInsertMock.mockClear();
  caseScoresInsertMock.mockClear();
  supabaseRpcMock.mockReset();
  supabaseRpcMock.mockResolvedValue({ data: [], error: null });
  templateQuery.select.mockClear();
  templateQuery.in.mockClear();
  templateQuery.eq.mockClear();
  templateQuery.or.mockClear();
  templateQuery.order.mockClear();

  runRetrievalSelectBuilder.setResponse([
    {
      origin: 'file_search',
      snippet: 'Article 1240 du Code civil',
      similarity: 0.92,
      weight: 1,
      metadata: {
        trustTier: 'T1',
        sourceId: 'src-1',
        url: validPayload.citations[0]?.url,
        title: 'Code civil',
        publisher: 'Légifrance',
      },
    },
  ]);
  caseScoresQuery.setResponse([
    {
      source_id: 'src-1',
      score_overall: 82,
      axes: { PW: 80, ST: 78, SA: 90, PI: 70, JF: 85, LB: 65, RC: 72, CQ: 74 },
      hard_block: false,
      notes: ['Jurisprudence solide'],
      computed_at: new Date().toISOString(),
    },
  ]);
  sourcesQuery.setResponse([
    {
      id: 'src-1',
      source_url: validPayload.citations[0]?.url,
      title: 'Code civil',
      publisher: 'Légifrance',
      source_type: 'case',
      trust_tier: 'T1',
      residency_zone: 'eu',
      binding_lang: 'fr',
      eli: 'fr/code_civil/article_1240',
      ecli: null,
      akoma_ntoso: { body: { articles: [{ marker: 'Article 1240', seq: 0, excerpt: 'Texte' }] } },
    },
  ]);
  hitlQueueQuery.setResponse([], null);

  process.env.OPENAI_API_KEY = 'test';
  process.env.AGENT_MODEL = 'gpt-test';
  process.env.EMBEDDING_MODEL = 'text-embedding-test';
  process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_test';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.AGENT_STUB_MODE = 'never';
  delete process.env.JURIS_ALLOWLIST_JSON;

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/embeddings')) {
      return {
        ok: true,
        json: async () => ({ data: [{ embedding: new Array(3072).fill(0.1) }] }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  });

  vi.doMock('@openai/agents', () => ({
    Agent: class {
      constructor(config: unknown) {
        this.config = config;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: any;
    },
    run: runMock,
    tool: vi.fn((options) => ({ ...options })),
    defineOutputGuardrail: vi.fn((options) => options),
    webSearchTool: vi.fn(() => ({ type: 'hosted_tool', name: 'web_search' })),
    fileSearchTool: vi.fn(() => ({ type: 'hosted_tool', name: 'file_search' })),
    setDefaultModelProvider: vi.fn(),
    setDefaultOpenAIKey: vi.fn(),
    setOpenAIAPI: vi.fn(),
    OpenAIProvider: class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_options?: unknown) {}
    },
  }));

  vi.doMock('@avocat-ai/supabase', () => ({
    createServiceClient: vi.fn(() => ({
      rpc: supabaseRpcMock,
      from: (table: string) => {
        if (table === 'agent_runs') {
          return {
            insert: runInsertMock,
            select: agentRunsTableSelect,
            update: agentRunsUpdateMock,
          };
        }
        if (table === 'run_retrieval_sets') {
          return {
            insert: retrievalInsertMock,
            select: vi.fn(() => runRetrievalSelectBuilder),
          };
        }
        if (table === 'run_citations') {
          return { insert: citationsInsertMock };
        }
        if (table === 'tool_invocations') {
          return { insert: toolInsertMock, select: toolInvocationsTableSelect };
        }
        if (table === 'hitl_queue') {
          return { insert: hitlInsertMock, select: vi.fn(() => hitlQueueQuery) };
        }
        if (table === 'hitl_reviewer_edits') {
          return { insert: vi.fn(() => ({ error: null })), select: vi.fn(() => createAsyncQuery()) };
        }
        if (table === 'tool_telemetry') {
          return { insert: telemetryInsertMock };
        }
        if (table === 'agent_learning_jobs') {
          return { insert: learningInsertMock };
        }
        if (table === 'audit_events') {
          return { insert: auditInsertMock };
        }
        if (table === 'agent_synonyms') {
          return synonymsQuery;
        }
        if (table === 'agent_policy_versions') {
          return policyVersionsQuery;
        }
        if (table === 'case_scores') {
          return { ...caseScoresQuery, insert: caseScoresInsertMock };
        }
        if (table === 'compliance_assessments') {
          return {
            insert: vi.fn(async () => ({ error: null })),
            select: vi.fn(() => complianceAssessmentsQuery),
          };
        }
        if (
          table === 'case_treatments' ||
          table === 'case_statute_links' ||
          table === 'case_score_overrides' ||
          table === 'risk_register'
        ) {
          return createAsyncQuery();
        }
        if (table === 'sources') {
          return sourcesQuery;
        }
        if (table === 'pleading_templates') {
          return templateQuery;
        }
        if (table === 'fria_artifacts') {
          return createAsyncQuery();
        }
        throw new Error(`unexpected table ${table}`);
      },
    })),
  }));
});

describe('runLegalAgent', () => {
  it('returns a parsed IRAC payload for allowlisted citations', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          content: 'Article 1240 du Code civil',
          similarity: 0.93,
          trust_tier: 'T1',
          source_id: 'src-1',
          document_id: 'doc-1',
        },
      ],
      error: null,
    });

    const { runLegalAgent } = await importAgentModule();
    const result = await runLegalAgent(
      {
        question: 'Analyse en France',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(result.payload.conclusion).toContain('valable');
    expect(result.runId).toBe('run-1');
    expect(runInsertMock).toHaveBeenCalled();
    expect(toolInsertMock).toHaveBeenCalled();
    expect(learningInsertMock).not.toHaveBeenCalled();
    expect(result.verification?.status).toBe('passed');
    expect(result.verification?.notes).toHaveLength(0);
    expect(result.trustPanel).toBeDefined();
    expect(result.trustPanel?.citationSummary.allowlisted).toBeGreaterThan(0);
    expect(result.trustPanel?.risk.level).toBe('LOW');
    expect(result.trustPanel?.provenance.totalSources).toBeGreaterThan(0);
    expect(result.trustPanel?.provenance.withEli).toBeGreaterThan(0);
    expect(result.trustPanel?.provenance.akomaArticles).toBeGreaterThanOrEqual(1);
    expect(result.agent.code).toBe('conseil_recherche');
    expect(result.agent.tools.length).toBeGreaterThan(0);
  }, 15000);

  it('forces a trust-panel HITL when case quality is blocked', async () => {
    caseScoresQuery.setResponse([
      {
        source_id: 'src-1',
        score_overall: 40,
        axes: { PW: 40, ST: 35, SA: 45, PI: 30, JF: 42, LB: 38, RC: 36, CQ: 33 },
        hard_block: true,
        notes: ['Blocage manuel'],
        computed_at: new Date().toISOString(),
      },
    ]);

    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    const { runLegalAgent } = await importAgentModule();
    const result = await runLegalAgent(
      {
        question: 'Analyse en France',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(result.trustPanel?.caseQuality.forceHitl).toBe(true);
    const firstCase = result.trustPanel?.caseQuality.items[0];
    expect(firstCase?.hardBlock).toBe(true);
  });

  it('computes case quality metrics and persists jurisprudence scores', async () => {
    const caseUrl = 'https://www.sgg.gov.ma/lois/cour-cassation/2024-01-01';

    runMock.mockResolvedValue({
      finalOutput: {
        ...validPayload,
        citations: [
          {
            ...validPayload.citations[0],
            title: 'Cour de cassation, 1er janvier 2024',
            url: caseUrl,
            court_or_publisher: 'Cour de cassation du Maroc',
          },
        ],
      },
    });

    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          content: 'Décision de jurisprudence',
          similarity: 0.88,
          trust_tier: 'T2',
          source_type: 'case_law',
          source_id: 'src-case',
          document_id: 'doc-case',
        },
      ],
      error: null,
    });

    caseScoresQuery.setResponse([], null);
    sourcesQuery.setResponse([
      {
        id: 'src-case',
        source_url: caseUrl,
        title: 'Cour de cassation du Maroc',
        publisher: 'Secrétariat général du gouvernement',
        source_type: 'case_law',
        trust_tier: 'T2',
        jurisdiction_code: 'MA',
        binding_lang: 'ar',
        effective_date: '2024-01-01',
        created_at: '2024-01-02',
        political_risk_flag: false,
        court_rank: 'CC',
        court_identifier: 'CC-MA',
        akoma_ntoso: null,
        eli: null,
        ecli: null,
      },
    ]);

    const { runLegalAgent } = await importAgentModule();

    await runLegalAgent(
      {
        question: 'Analyse de jurisprudence marocaines',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(caseScoresInsertMock).toHaveBeenCalled();
    const payloadArg = caseScoresInsertMock.mock.calls[0]?.[0];
    expect(payloadArg).toMatchObject({
      org_id: '00000000-0000-0000-0000-000000000000',
      source_id: 'src-case',
      juris_code: 'MA',
      hard_block: expect.any(Boolean),
    });
  });

  it('throws when a citation is not allowlisted', async () => {
    const payload = {
      ...validPayload,
      citations: [
        {
          ...validPayload.citations[0],
          url: 'https://example.com/non-official',
        },
      ],
    };

    runMock.mockResolvedValue({
      finalOutput: payload,
    });

    const { runLegalAgent } = await importAgentModule();

    await expect(
      runLegalAgent(
        {
          question: 'Analyse',
          orgId: '00000000-0000-0000-0000-000000000000',
          userId: '00000000-0000-0000-0000-000000000000',
        },
        makeContext(),
      ),
    ).rejects.toThrow(/hors périmètre/);
  });

  it('enqueues a HITL review when requested by the model', async () => {
    runMock.mockResolvedValue({
      finalOutput: {
        ...validPayload,
        risk: { ...validPayload.risk, level: 'HIGH', hitl_required: true, why: 'Escalade obligatoire' },
      },
    });

    const { runLegalAgent } = await importAgentModule();
    await runLegalAgent(
      {
        question: 'Analyse pénale complexe',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(hitlInsertMock).toHaveBeenCalled();
  });

  it('creates an indexing learning job when no citation is returned', async () => {
    runMock.mockResolvedValue({
      finalOutput: { ...validPayload, citations: [] },
    });

    const { runLegalAgent } = await importAgentModule();
    await runLegalAgent(
      {
        question: 'Analyse en France',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(learningInsertMock).toHaveBeenCalled();
    const payloadArg = learningInsertMock.mock.calls[0]?.[0]?.[0];
    expect(payloadArg?.type).toBe('indexing_ticket');
  });

  it('reuses an existing run when the run key matches', async () => {
    const existingPlan = [
      {
        id: 'route_jurisdiction',
        name: 'Analyse de juridiction',
        description: 'Détection préalable',
        startedAt: new Date(0).toISOString(),
        finishedAt: new Date(0).toISOString(),
        status: 'success',
        attempts: 1,
      },
    ];

    agentRunsSelectBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'existing-run',
        irac: validPayload,
        plan_trace: existingPlan,
        confidential_mode: false,
        verification_status: 'passed',
        verification_notes: [],
      },
      error: null,
    });

    toolInvocationsSelectBuilder.order.mockResolvedValueOnce({
      data: [
        {
          tool_name: 'file_search',
          args: JSON.stringify({ query: 'analyse' }),
          output: JSON.stringify({ hits: [] }),
        },
      ],
      error: null,
    });

    const { runLegalAgent } = await importAgentModule();
    const result = await runLegalAgent(
      {
        question: 'Analyse en France',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(result.reused).toBe(true);
    expect(result.runId).toBe('existing-run');
    expect(result.plan).toEqual(existingPlan);
    expect(runMock).not.toHaveBeenCalled();
    expect(runInsertMock).not.toHaveBeenCalled();
    expect(result.verification?.status).toBe('passed');
    expect(result.trustPanel?.caseQuality.items[0]?.score).toBeGreaterThan(0);
  });

  it('disables web search when confidential mode is active', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    const { runLegalAgent } = await importAgentModule();
    await runLegalAgent(
      {
        question: 'Analyse confidentielle',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
        confidentialMode: true,
      },
      makeContext(),
    );

    const agentInstance = runMock.mock.calls[0]?.[0] as { config?: { tools?: Array<{ name?: string }> } } | undefined;
    const toolNames = agentInstance?.config?.tools?.map((tool) => tool?.name) ?? [];
    expect(toolNames).not.toContain('web_search');
  });

  it('configures allowlist web search by default', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    const overrideDomains = [
      'legifrance.gouv.fr',
      ...Array.from({ length: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX + 5 }, (_, index) => `domain${index}.example`),
    ];
    process.env.JURIS_ALLOWLIST_JSON = JSON.stringify(overrideDomains);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { runLegalAgent } = await importAgentModule();
    await runLegalAgent(
      {
        question: 'Analyse en France',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    const agentsModule = await import('@openai/agents');
    const webSearchToolMock = agentsModule.webSearchTool as unknown as vi.Mock;
    expect(webSearchToolMock).toHaveBeenCalled();
    const options = webSearchToolMock.mock.calls[0]?.[0] as
      | { filters?: { allowedDomains?: string[] }; searchContextSize?: string }
      | undefined;
    expect(options?.searchContextSize).toBe('medium');
    expect(options?.filters?.allowedDomains).toHaveLength(DEFAULT_WEB_SEARCH_ALLOWLIST_MAX);
    expect(warnSpy).toHaveBeenCalledWith(
      'web_search_allowlist_truncated',
      expect.objectContaining({
        truncatedCount: 6,
        totalDomains: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX + 6,
        maxDomains: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX,
        source: 'override',
      }),
    );

    warnSpy.mockRestore();
    delete process.env.JURIS_ALLOWLIST_JSON;
  });

  it('avoids caching telemetry and hybrid retrieval data when confidential mode is active', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          content: 'Article 1240 du Code civil',
          similarity: 0.92,
          trust_tier: 'T1',
          source_type: 'statute',
          source_id: 'src-1',
          document_id: 'doc-1',
        },
      ],
      error: null,
    });

    const { runLegalAgent } = await importAgentModule();

    await runLegalAgent(
      {
        question: 'Analyse publique',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(retrievalInsertMock).toHaveBeenCalled();

    retrievalInsertMock.mockClear();
    telemetryInsertMock.mockClear();

    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          content: 'Article 1240 du Code civil',
          similarity: 0.91,
          trust_tier: 'T1',
          source_type: 'statute',
          source_id: 'src-1',
          document_id: 'doc-1',
        },
      ],
      error: null,
    });

    await runLegalAgent(
      {
        question: 'Analyse confidentielle',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
        confidentialMode: true,
      },
      makeContext({ policies: { ...defaultAccessContext.policies, confidentialMode: true } }),
    );

    expect(retrievalInsertMock).not.toHaveBeenCalled();
    expect(telemetryInsertMock).not.toHaveBeenCalled();
  });

  it('augments hybrid retrieval queries with learned synonyms', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    synonymsQuery.setResponse(
      [
        {
          jurisdiction: 'FR',
          term: 'prescription',
          expansions: ['forclusion', 'délai de recours'],
        },
      ],
      null,
    );

    policyVersionsQuery.setResponse([], null);

    supabaseRpcMock.mockResolvedValueOnce({ data: [], error: null });

    const { runLegalAgent } = await importAgentModule();

    await runLegalAgent(
      {
        question: 'Quelle prescription s’applique en France pour cette action ?',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    const embeddingCall = (global.fetch as unknown as vi.Mock).mock.calls.find((call) =>
      (typeof call[0] === 'string' ? call[0] : call[0].toString()).includes('/embeddings'),
    );
    expect(embeddingCall).toBeTruthy();
    const body = JSON.parse((embeddingCall?.[1] as RequestInit)?.body as string);
    expect(body.input).toContain('Synonymes pertinents');
    expect(body.input).toContain('forclusion');
  });

  it('blocks judge analytics queries for France and escalates to HITL', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    const { runLegalAgent } = await importAgentModule();
    const result = await runLegalAgent(
      {
        question:
          'Peux-tu analyser les statistiques et classer les juges de la Cour d\'appel de Paris selon leurs décisions ?',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(runMock).not.toHaveBeenCalled();
    expect(result.payload.risk.hitl_required).toBe(true);
    expect(result.payload.rules[0]?.source_url).toContain('legifrance.gouv.fr');
    expect(hitlInsertMock).toHaveBeenCalled();
    const learningPayload = learningInsertMock.mock.calls[0]?.[0]?.[0];
    expect(learningPayload?.type).toBe('guardrail_fr_judge_analytics');
  });

  it('escalates to HITL when the binding-language guardrail blocks the output', async () => {
    runMock.mockRejectedValue(new Error('Output rejected by guardrail binding-language-guardrail.'));

    const guardUrl = 'https://www.sgg.gov.ma/lois/texte-arabe';
    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          content: 'Décision marocaine sensible',
          similarity: 0.9,
          trust_tier: 'T1',
          source_type: 'case_law',
          source_id: 'src-ma',
          document_id: 'doc-ma',
        },
      ],
      error: null,
    });

    sourcesQuery.setResponse([
      {
        id: 'src-ma',
        source_url: guardUrl,
        title: 'Arrêt de la Cour de cassation (MA)',
        publisher: 'Cour de cassation du Maroc',
        source_type: 'case_law',
        jurisdiction_code: 'MA',
        trust_tier: 'T2',
        binding_lang: 'ar',
        effective_date: '2024-03-12',
        created_at: '2024-03-13',
        political_risk_flag: false,
        court_rank: 'CC',
        court_identifier: 'CC-MA',
      },
    ]);

    const { runLegalAgent } = await importAgentModule();

    const result = await runLegalAgent(
      {
        question: 'Analyse ce récent arrêt marocain important.',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(result.verification?.status).toBe('hitl_escalated');
    expect(result.verification?.notes[0]?.code).toBe('binding_language_guardrail');
    expect(hitlInsertMock).toHaveBeenCalled();
    const guardStep = result.plan?.find((step) => step.id === 'guardrail_binding-language');
    expect(guardStep?.status).toBe('failed');
    const guardLog = result.toolLogs.find((log) => log.name === 'guardrailEscalation');
    expect(guardLog?.output).toMatchObject({ escalated: true });
  });

  it('escalates to HITL when the structured IRAC guardrail blocks the output', async () => {
    runMock.mockRejectedValue(new Error('Output rejected by guardrail structured-irac-guardrail.'));

    const { runLegalAgent } = await importAgentModule();

    const result = await runLegalAgent(
      {
        question: 'Produit une réponse structurée détaillée.',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(result.verification?.status).toBe('hitl_escalated');
    expect(result.verification?.notes[0]?.code).toBe('structured_irac_guardrail');
    const guardStep = result.plan?.find((step) => step.id === 'guardrail_structured-irac');
    expect(guardStep?.status).toBe('failed');
  });

  it('escalates to HITL when the sensitive topic guardrail blocks the output', async () => {
    runMock.mockRejectedValue(new Error('Output rejected by guardrail sensitive-topic-hitl-guardrail.'));

    const { runLegalAgent } = await importAgentModule();

    const result = await runLegalAgent(
      {
        question: 'Analyse une question hautement sensible et politique.',
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(result.verification?.status).toBe('hitl_escalated');
    expect(result.verification?.notes[0]?.code).toBe('sensitive_topic_hitl_guardrail');
    const guardStep = result.plan?.find((step) => step.id === 'guardrail_sensitive-topic');
    expect(guardStep?.status).toBe('failed');
  });

  it('blocks execution when jurisdiction entitlement is missing', async () => {
    runMock.mockResolvedValue({ finalOutput: validPayload });

    const { runLegalAgent } = await importAgentModule();

    await expect(
      runLegalAgent(
        {
          question: "Analyse une clause contractuelle applicable devant le tribunal judiciaire de Paris, en France.",
          orgId: '00000000-0000-0000-0000-000000000000',
          userId: '00000000-0000-0000-0000-000000000000',
        },
        makeContext({
          entitlements: new Map<string, { canRead: boolean; canWrite: boolean }>([['FR', { canRead: false, canWrite: false }]]),
        }),
      ),
    ).rejects.toThrowError('jurisdiction_not_entitled');

    expect(runMock).not.toHaveBeenCalled();
  });

  it('disables web search when confidential mode is enforced via policy', async () => {
    runMock.mockResolvedValue({ finalOutput: validPayload });

    const { runLegalAgent } = await importAgentModule();

    await runLegalAgent(
      {
        question: 'Analyse confidentielle sur une clause de non-concurrence.',
        confidentialMode: false,
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext({
        policies: {
          ...defaultAccessContext.policies,
          confidentialMode: true,
        },
      }),
    );

    const plan = runMock.mock.calls[0]?.[0]?.plan_trace ?? [];
    const agentContext = runMock.mock.calls[0]?.[0]?.context ?? {};

    // Ensure web_search budget is zero when confidential mode enforced
    expect(agentContext.toolBudgets?.web_search ?? 0).toBe(0);
    // Ensure web search tool not invoked
    const toolNames = (runMock.mock.calls[0]?.[0]?.tools ?? []).map((tool: { name: string }) => tool.name);
    expect(toolNames).not.toContain('web_search');
  });


  it('requires a FRIA checkpoint for EU litigation scenarios', async () => {
    runMock.mockResolvedValue({
      finalOutput: validPayload,
    });

    const { runLegalAgent } = await importAgentModule();
    await runLegalAgent(
      {
        question:
          "Prépare une requête introductive d'instance devant le tribunal judiciaire de Paris pour contester une sanction disciplinaire.",
        orgId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      },
      makeContext(),
    );

    expect(hitlInsertMock).toHaveBeenCalled();
    const learningBatch = learningInsertMock.mock.calls.at(-1)?.[0] ?? [];
    const hasFriaTicket = learningBatch.some((job: { type?: string }) => job.type === 'compliance_fria_ticket');
    expect(hasFriaTicket).toBe(true);
    const auditBatch = auditInsertMock.mock.calls.at(-1)?.[0] ?? [];
    const hasFriaAudit = auditBatch.some(
      (event: { kind?: string }) => event.kind === 'compliance.eu_ai_act.fria_required',
    );
    expect(hasFriaAudit).toBe(true);
  });
});
