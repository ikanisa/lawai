import { defineSchema } from '../../../core/schema/registry.js';
import { openApiRegistry, z } from '../../../http/openapi/registry.js';
import { HttpErrorResponseSchema } from '../../../http/schemas/error.js';

const WorkspaceJurisdictionSchema = openApiRegistry.register(
  'WorkspaceJurisdiction',
  z
    .object({
      code: z.string().describe('Jurisdiction code'),
      name: z.string().describe('Jurisdiction name'),
      eu: z.boolean().describe('Whether the jurisdiction is part of the EU'),
      ohada: z.boolean().describe('Whether the jurisdiction is part of OHADA'),
      matterCount: z.number().int().nonnegative().describe('Number of matters associated with the jurisdiction'),
    })
    .describe('Jurisdiction summary with matter counts'),
);

const WorkspaceMatterSchema = openApiRegistry.register(
  'WorkspaceMatter',
  z
    .object({
      id: z.string(),
      question: z.string(),
      status: z.string().nullable(),
      riskLevel: z.string().nullable(),
      hitlRequired: z.boolean().nullable(),
      startedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
      jurisdiction: z.string().nullable(),
    })
    .describe('Workspace matter overview'),
);

const WorkspaceComplianceWatchSchema = openApiRegistry.register(
  'WorkspaceComplianceWatch',
  z
    .object({
      id: z.string(),
      title: z.string(),
      publisher: z.string().nullable(),
      url: z.string(),
      jurisdiction: z.string().nullable(),
      consolidated: z.boolean().nullable(),
      effectiveDate: z.string().nullable(),
      createdAt: z.string().nullable(),
    })
    .describe('Compliance watch entry'),
);

const WorkspaceHitlInboxItemSchema = openApiRegistry.register(
  'WorkspaceHitlInboxItem',
  z
    .object({
      id: z.string(),
      runId: z.string(),
      reason: z.string(),
      status: z.string(),
      createdAt: z.string().nullable(),
    })
    .describe('HITL inbox item'),
);

const WorkspaceHitlInboxSchema = openApiRegistry.register(
  'WorkspaceHitlInbox',
  z
    .object({
      items: z.array(WorkspaceHitlInboxItemSchema),
      pendingCount: z.number().int().nonnegative(),
    })
    .describe('HITL inbox summary'),
);

const WorkspaceDeskPlaybookStepSchema = openApiRegistry.register(
  'WorkspaceDeskPlaybookStep',
  z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      status: z.enum(['success', 'skipped', 'failed']),
      attempts: z.number().int().nonnegative(),
      detail: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .describe('Step within a workspace playbook'),
);

const WorkspaceDeskPlaybookSchema = openApiRegistry.register(
  'WorkspaceDeskPlaybook',
  z
    .object({
      id: z.string(),
      title: z.string(),
      persona: z.string(),
      jurisdiction: z.string(),
      mode: z.enum(['ask', 'do', 'review', 'generate']),
      summary: z.string(),
      regulatoryFocus: z.array(z.string()),
      steps: z.array(WorkspaceDeskPlaybookStepSchema),
      cta: z.object({ label: z.string(), question: z.string().optional(), mode: z.enum(['ask', 'do', 'review', 'generate']) }),
    })
    .describe('Workspace playbook configuration'),
);

const WorkspaceDeskQuickActionSchema = openApiRegistry.register(
  'WorkspaceDeskQuickAction',
  z
    .object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      mode: z.enum(['ask', 'do', 'review', 'generate']),
      action: z.enum(['navigate', 'plan', 'trust', 'hitl']),
      href: z.string().optional(),
    })
    .describe('Quick action available from the workspace desk'),
);

const WorkspaceDeskPersonaSchema = openApiRegistry.register(
  'WorkspaceDeskPersona',
  z
    .object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      mode: z.enum(['ask', 'do', 'review', 'generate']),
      focusAreas: z.array(z.string()),
      guardrails: z.array(z.string()),
      href: z.string(),
      agentCode: z.string(),
    })
    .describe('Persona represented on the workspace desk'),
);

const WorkspaceDeskToolChipSchema = openApiRegistry.register(
  'WorkspaceDeskToolChip',
  z
    .object({
      id: z.string(),
      label: z.string(),
      mode: z.enum(['ask', 'do', 'review', 'generate']),
      status: z.enum(['ready', 'monitoring', 'requires_hitl']),
      description: z.string(),
      action: z.enum(['navigate', 'plan', 'trust', 'hitl']),
      href: z.string().optional(),
      ctaLabel: z.string(),
    })
    .describe('Tool chip rendered on the workspace desk'),
);

const WorkspaceDeskSchema = openApiRegistry.register(
  'WorkspaceDesk',
  z
    .object({
      playbooks: z.array(WorkspaceDeskPlaybookSchema),
      quickActions: z.array(WorkspaceDeskQuickActionSchema),
      personas: z.array(WorkspaceDeskPersonaSchema),
      toolChips: z.array(WorkspaceDeskToolChipSchema),
    })
    .describe('Workspace desk configuration'),
);

const WorkspaceNavigatorStepSchema = openApiRegistry.register(
  'WorkspaceNavigatorStep',
  z
    .object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      state: z.enum(['complete', 'in_progress', 'blocked']),
      guardrails: z.array(z.string()),
      outputs: z.array(z.string()),
      escalation: z.string().nullable().optional(),
    })
    .describe('Navigator flow step'),
);

const WorkspaceNavigatorTelemetrySchema = openApiRegistry.register(
  'WorkspaceNavigatorTelemetry',
  z
    .object({
      runCount: z.number().int().nonnegative(),
      hitlEscalations: z.number().int().nonnegative(),
      pendingTasks: z.number().int().nonnegative(),
    })
    .describe('Navigator telemetry snapshot'),
);

const WorkspaceNavigatorFlowSchema = openApiRegistry.register(
  'WorkspaceNavigatorFlow',
  z
    .object({
      id: z.string(),
      title: z.string(),
      jurisdiction: z.string(),
      persona: z.string(),
      mode: z.enum(['ask', 'do', 'review', 'generate']),
      summary: z.string(),
      estimatedMinutes: z.number().int().nonnegative(),
      lastRunAt: z.string().nullable(),
      alerts: z.array(z.string()),
      telemetry: WorkspaceNavigatorTelemetrySchema,
      steps: z.array(WorkspaceNavigatorStepSchema),
    })
    .describe('Navigator flow definition'),
);

const WorkspaceMetaSchema = openApiRegistry.register(
  'WorkspaceMeta',
  z
    .object({
      status: z.enum(['ok', 'partial']),
      warnings: z.array(z.string()),
      errors: z.record(z.string(), z.unknown()).optional(),
    })
    .describe('Metadata about the workspace response completeness'),
);

const WorkspaceOverviewSchema = openApiRegistry.register(
  'WorkspaceOverview',
  z
    .object({
      jurisdictions: z.array(WorkspaceJurisdictionSchema),
      matters: z.array(WorkspaceMatterSchema),
      complianceWatch: z.array(WorkspaceComplianceWatchSchema),
      hitlInbox: WorkspaceHitlInboxSchema,
      desk: WorkspaceDeskSchema,
      navigator: z.array(WorkspaceNavigatorFlowSchema),
    })
    .describe('Workspace overview payload'),
);

export const WorkspaceQuerySchema = defineSchema(
  'Workspace.GetWorkspace.Query',
  openApiRegistry.register(
    'WorkspaceQuery',
    z.object({ orgId: z.string().uuid().describe('Workspace organisation identifier') }),
  ),
);

export const WorkspaceHeadersSchema = defineSchema(
  'Workspace.GetWorkspace.Headers',
  openApiRegistry.register(
    'WorkspaceHeaders',
    z.object({ 'x-user-id': z.string().min(1).describe('Identifier of the authenticated user') }),
  ),
);

export const WorkspaceResponseSchema = defineSchema(
  'Workspace.GetWorkspace.Response',
  openApiRegistry.register(
    'WorkspaceResponse',
    WorkspaceOverviewSchema.extend({ meta: WorkspaceMetaSchema }),
  ),
);

openApiRegistry.registerPath({
  method: 'get',
  path: '/workspace',
  tags: ['Workspace'],
  summary: 'Fetch the workspace overview for an organisation',
  request: {
    query: WorkspaceQuerySchema,
    headers: WorkspaceHeadersSchema,
  },
  responses: {
    200: {
      description: 'Workspace overview response',
      content: {
        'application/json': { schema: WorkspaceResponseSchema },
      },
    },
    206: {
      description: 'Partial workspace overview with warnings',
      content: {
        'application/json': { schema: WorkspaceResponseSchema },
      },
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': { schema: HttpErrorResponseSchema },
      },
    },
    403: {
      description: 'Insufficient permissions to view the workspace',
      content: {
        'application/json': { schema: HttpErrorResponseSchema },
      },
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': { schema: HttpErrorResponseSchema },
      },
    },
    500: {
      description: 'Unexpected server error',
      content: {
        'application/json': { schema: HttpErrorResponseSchema },
      },
    },
  },
});

export type WorkspaceResponse = typeof WorkspaceResponseSchema['_output'];
export type WorkspaceQuery = typeof WorkspaceQuerySchema['_output'];
