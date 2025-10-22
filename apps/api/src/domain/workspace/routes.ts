import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../../types/context.js';
import { buildWorkspaceHandlers } from './handlers.js';

const workspaceQueryJsonSchema = {
  type: 'object',
  required: ['orgId'],
  additionalProperties: false,
  properties: {
    orgId: { type: 'string', minLength: 1 },
  },
} as const;

const workspaceHeaderSchema = {
  type: 'object',
  required: ['x-user-id'],
  additionalProperties: true,
  properties: {
    'x-user-id': { type: 'string' },
  },
} as const;

const workspaceResponseSchema = {
  type: 'object',
  required: ['jurisdictions', 'matters', 'complianceWatch', 'hitlInbox', 'desk', 'navigator'],
  properties: {
    jurisdictions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'name', 'eu', 'ohada', 'matterCount'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          eu: { type: 'boolean' },
          ohada: { type: 'boolean' },
          matterCount: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    matters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'question', 'status', 'riskLevel', 'hitlRequired', 'startedAt', 'finishedAt', 'jurisdiction'],
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          status: { type: ['string', 'null'] },
          riskLevel: { type: ['string', 'null'] },
          hitlRequired: { type: ['boolean', 'null'] },
          startedAt: { type: ['string', 'null'], format: 'date-time' },
          finishedAt: { type: ['string', 'null'], format: 'date-time' },
          jurisdiction: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
    complianceWatch: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'publisher', 'url', 'jurisdiction', 'consolidated', 'effectiveDate', 'createdAt'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          publisher: { type: ['string', 'null'] },
          url: { type: 'string' },
          jurisdiction: { type: ['string', 'null'] },
          consolidated: { type: ['boolean', 'null'] },
          effectiveDate: { type: ['string', 'null'] },
          createdAt: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
    hitlInbox: {
      type: 'object',
      required: ['items', 'pendingCount'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'runId', 'reason', 'status', 'createdAt'],
            properties: {
              id: { type: 'string' },
              runId: { type: 'string' },
              reason: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: ['string', 'null'] },
            },
            additionalProperties: false,
          },
        },
        pendingCount: { type: 'number' },
      },
      additionalProperties: false,
    },
    desk: { type: 'object', additionalProperties: true },
    navigator: { type: 'object', additionalProperties: true },
  },
  additionalProperties: false,
} as const;

const complianceHeadersSchema = {
  type: 'object',
  required: ['x-user-id', 'x-org-id'],
  additionalProperties: true,
  properties: {
    'x-user-id': { type: 'string' },
    'x-org-id': { type: 'string' },
  },
} as const;

const acknowledgementBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    consent: {
      anyOf: [
        {
          type: 'object',
          required: ['type', 'version'],
          additionalProperties: false,
          properties: {
            type: { type: 'string' },
            version: { type: 'string' },
          },
        },
        { type: 'null' },
      ],
    },
    councilOfEurope: {
      anyOf: [
        {
          type: 'object',
          required: ['version'],
          additionalProperties: false,
          properties: {
            version: { type: 'string' },
          },
        },
        { type: 'null' },
      ],
    },
  },
  anyOf: [{ required: ['consent'] }, { required: ['councilOfEurope'] }],
} as const;

const acknowledgementDetailsSchema = {
  type: 'object',
  required: ['requiredVersion', 'acknowledgedVersion', 'acknowledgedAt', 'satisfied'],
  properties: {
    requiredVersion: { type: ['string', 'null'] },
    acknowledgedVersion: { type: ['string', 'null'] },
    acknowledgedAt: { type: ['string', 'null'] },
    satisfied: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const acknowledgementResponseSchema = {
  type: 'object',
  required: ['orgId', 'userId', 'acknowledgements'],
  properties: {
    orgId: { type: 'string' },
    userId: { type: 'string' },
    acknowledgements: {
      type: 'object',
      required: ['consent', 'councilOfEurope'],
      properties: {
        consent: acknowledgementDetailsSchema,
        councilOfEurope: acknowledgementDetailsSchema,
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const complianceStatusQueryJsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    limit: { type: 'string', pattern: '^[0-9]+$' },
  },
} as const;

const complianceAssessmentSchema = {
  type: 'object',
  required: ['fria', 'cepej', 'statute', 'disclosures'],
  properties: {
    fria: {
      type: 'object',
      required: ['required', 'reasons'],
      properties: {
        required: { type: 'boolean' },
        reasons: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    cepej: {
      type: 'object',
      required: ['passed', 'violations'],
      properties: {
        passed: { type: 'boolean' },
        violations: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    statute: {
      type: 'object',
      required: ['passed', 'violations'],
      properties: {
        passed: { type: 'boolean' },
        violations: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    disclosures: {
      type: 'object',
      required: [
        'consentSatisfied',
        'councilSatisfied',
        'missing',
        'requiredConsentVersion',
        'acknowledgedConsentVersion',
        'requiredCoeVersion',
        'acknowledgedCoeVersion',
      ],
      properties: {
        consentSatisfied: { type: 'boolean' },
        councilSatisfied: { type: 'boolean' },
        missing: { type: 'array', items: { type: 'string' } },
        requiredConsentVersion: { type: ['string', 'null'] },
        acknowledgedConsentVersion: { type: ['string', 'null'] },
        requiredCoeVersion: { type: ['string', 'null'] },
        acknowledgedCoeVersion: { type: ['string', 'null'] },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const complianceHistoryEntrySchema = {
  type: 'object',
  required: ['runId', 'createdAt', 'assessment'],
  properties: {
    runId: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    assessment: complianceAssessmentSchema,
  },
  additionalProperties: false,
} as const;

const complianceStatusResponseSchema = {
  type: 'object',
  required: ['orgId', 'userId', 'acknowledgements', 'latest', 'history', 'totals'],
  properties: {
    orgId: { type: 'string' },
    userId: { type: 'string' },
    acknowledgements: acknowledgementResponseSchema.properties.acknowledgements,
    latest: { anyOf: [{ type: 'null' }, complianceHistoryEntrySchema] },
    history: { type: 'array', items: complianceHistoryEntrySchema },
    totals: {
      type: 'object',
      required: ['total', 'friaRequired', 'cepejViolations', 'statuteViolations', 'disclosureGaps'],
      properties: {
        total: { type: 'number' },
        friaRequired: { type: 'number' },
        cepejViolations: { type: 'number' },
        statuteViolations: { type: 'number' },
        disclosureGaps: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  const handlers = buildWorkspaceHandlers(ctx);

  app.get(
    '/workspace',
    {
      schema: {
        querystring: workspaceQueryJsonSchema,
        headers: workspaceHeaderSchema,
        response: {
          200: workspaceResponseSchema,
        },
      },
    },
    handlers.getWorkspace.bind(handlers),
  );

  app.get(
    '/compliance/acknowledgements',
    {
      schema: {
        headers: complianceHeadersSchema,
        response: {
          200: acknowledgementResponseSchema,
        },
      },
    },
    handlers.getComplianceAcknowledgements.bind(handlers),
  );

  app.post(
    '/compliance/acknowledgements',
    {
      schema: {
        headers: complianceHeadersSchema,
        body: acknowledgementBodySchema,
        response: {
          200: acknowledgementResponseSchema,
        },
      },
    },
    handlers.postComplianceAcknowledgements.bind(handlers),
  );

  app.get(
    '/compliance/status',
    {
      schema: {
        headers: complianceHeadersSchema,
        querystring: complianceStatusQueryJsonSchema,
        response: {
          200: complianceStatusResponseSchema,
        },
      },
    },
    handlers.getComplianceStatus.bind(handlers),
  );
}
