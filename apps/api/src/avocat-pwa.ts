import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
// @ts-nocheck
import { z } from 'zod';
import {
  AgentRunSchema,
  AgentRunRequestSchema,
  AgentStreamRequestSchema,
  ResearchStreamPayload,
  UploadResponseSchema,
  VoiceRunRequestSchema,
  VoiceSessionTokenSchema,
} from '@avocat-ai/shared/pwa';
import {
  researchDeskContext,
  researchAnswerChunks,
  researchToolSummaries,
  citationsData,
  mattersData,
  hitlQueueData,
  corpusDashboardData,
  policyConfiguration,
  voiceConsoleContext,
  buildVoiceRunResponse,
  defaultWebSearchMode,
  webSearchModes,
} from './avocat-pwa-data.js';

interface StreamEvent {
  type: 'token' | 'tool' | 'citation' | 'risk' | 'done';
  data: Partial<ResearchStreamPayload> & {
    tool?: ResearchStreamPayload['tool'];
    citation?: ResearchStreamPayload['citation'];
  };
}

const WebSearchModeSchema = z.enum(webSearchModes);
const RunRequestSchema = AgentRunRequestSchema.extend({
  web_search_mode: WebSearchModeSchema.optional(),
});
const StreamRequestSchema = AgentStreamRequestSchema.extend({
  web_search_mode: WebSearchModeSchema.optional(),
});

function sendEvent(reply: FastifyReply, event: StreamEvent) {
  reply.raw.write(`${JSON.stringify(event)}\n`);
}

export function registerAvocatPwaRoutes(app: FastifyInstance) {
  app.get('/api/research/context', async () => researchDeskContext);

  app.post(
    '/api/agents/run',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            input: { type: 'string' },
            jurisdiction: { type: ['string', 'null'] },
            policy_flags: { type: 'array', items: { type: 'string' } },
            user_location: { type: 'string' },
          },
          required: ['agent_id', 'input'],
          additionalProperties: true,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      const parsed = AgentRunRequestSchema.parse(request.body ?? {});
      const webSearchMode = parsed.web_search_mode ?? 'allowlist';
      const now = new Date().toISOString();
      const run = AgentRunSchema.parse({
        id: `run_${randomUUID()}`,
        agentId: parsed.agent_id,
        threadId: `thread_${randomUUID()}`,
        status: 'running',
        createdAt: now,
        updatedAt: now,
        input: parsed.input,
        jurisdiction: parsed.jurisdiction ?? null,
        policyFlags: parsed.policy_flags ?? [],
        userLocation: parsed.user_location ?? null,
      });
    reply.code(201);
    return run;
    },
  );

  app.post(
    '/api/agents/stream',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            tools_enabled: { type: 'array', items: { type: 'string' } },
            input: { type: 'string' },
            jurisdiction: { type: ['string', 'null'] },
            policy_flags: { type: 'array', items: { type: 'string' } },
            user_location: { type: 'string' },
          },
          required: ['tools_enabled', 'input'],
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const parsed = AgentStreamRequestSchema.parse(request.body ?? {});
      const webSearchMode = parsed.web_search_mode ?? 'allowlist';
      const toolsEnabled = parsed.tools_enabled ?? [];
      const includeWebSearch = webSearchMode !== 'disabled' && toolsEnabled.includes('web_search');

      const webSearchSummaries = {
        allowlist: {
          start: 'Requête ciblée sur le JO OHADA et les bulletins officiels.',
          success: 'Sources publiques vérifiées et ajoutées aux preuves.',
        },
        broad: {
          start: 'Recherche web élargie sur les domaines publics surveillés.',
          success: 'Résultats open web ajoutés avec bannière de prudence.',
        },
      } as const;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();
      reply.hijack();

      const baseToolEvents: StreamEvent[] = [
        {
          type: 'tool',
          data: {
            tool: {
              id: toolsEnabled[0] ?? 'lookupCodeArticle',
              name: toolsEnabled[0] ?? 'lookupCodeArticle',
              status: 'running',
              detail: researchToolSummaries.lookupCodeArticle.start,
              planStepId: 'step-intake',
            },
          },
        },
      ];

      if (includeWebSearch) {
        const details = webSearchSummaries[webSearchMode === 'broad' ? 'broad' : 'allowlist'];
        baseToolEvents.push({
          type: 'tool',
          data: {
            tool: {
              id: 'web_search',
              name: 'web_search',
              status: 'running',
              detail: details.start,
              planStepId: 'step-risk',
            },
          },
        });
      }

      const tokenEvents: StreamEvent[] = researchAnswerChunks.map((chunk) => ({
        type: 'token',
        data: { token: `${chunk} ` },
      }));

      const citationEvents: StreamEvent[] = researchDeskContext.defaultCitations
        .slice(0, 2)
        .map((citation: any) => ({
          type: 'citation',
          data: { citation },
        }));

      const completionEvents: StreamEvent[] = [
        {
          type: 'tool',
          data: {
            tool: {
              id: toolsEnabled[0] ?? 'lookupCodeArticle',
              name: toolsEnabled[0] ?? 'lookupCodeArticle',
              status: 'success',
              detail: researchToolSummaries.lookupCodeArticle.success,
              planStepId: 'step-intake',
            },
          },
        },
        {
          type: 'tool',
          data: {
            tool: {
              id: 'limitationCheck',
              name: 'limitationCheck',
              status: 'running',
              detail: researchToolSummaries.limitationCheck.start,
              planStepId: 'step-deadline',
            },
          },
        },
        {
          type: 'tool',
          data: {
            tool: {
              id: 'limitationCheck',
              name: 'limitationCheck',
              status: 'success',
              detail: researchToolSummaries.limitationCheck.success,
              planStepId: 'step-deadline',
            },
          },
        },
        {
          type: 'risk',
          data: {
            risk: {
              level: researchDeskContext.plan.riskLevel,
              summary: researchDeskContext.plan.riskSummary,
            },
          },
        },
        { type: 'done', data: {} },
      ];

      if (includeWebSearch) {
        const details = webSearchSummaries[webSearchMode === 'broad' ? 'broad' : 'allowlist'];
        completionEvents.splice(1, 0, {
          type: 'tool',
          data: {
            tool: {
              id: 'web_search',
              name: 'web_search',
              status: 'success',
              detail: details.success,
              planStepId: 'step-risk',
            },
          },
        });
      }

      const events = [...baseToolEvents, ...tokenEvents, ...citationEvents, ...completionEvents];

      let index = 0;
      const interval = setInterval(() => {
        if (index >= events.length) {
          clearInterval(interval);
          reply.raw.end();
          return;
        }
        sendEvent(reply, events[index]);
        index += 1;
      }, 250);

      request.raw.on('close', () => {
        clearInterval(interval);
      });
    },
  );

  app.post(
    '/api/upload',
    { schema: { response: { 200: { type: 'object', additionalProperties: true } } } },
    async () => {
      const payload = UploadResponseSchema.parse({
        uploadId: `upload_${randomUUID()}`,
        status: 'queued',
        receivedAt: new Date().toISOString(),
      });
      return payload;
    },
  );

  app.get('/api/citations', async () => citationsData);
  app.get('/api/matters', async () => mattersData);
  app.get('/api/hitl', async () => hitlQueueData);

  const hitlActionSchema = z.object({ action: z.enum(['approve', 'request_changes', 'reject']) });

  app.post<{ Params: { id: string } }>(
    '/api/hitl/:id',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        body: {
          type: 'object',
          properties: { action: { type: 'string', enum: ['approve', 'request_changes', 'reject'] } },
          required: ['action'],
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const body = hitlActionSchema.safeParse(request.body ?? {});
      const action = body.success ? body.data.action : 'acknowledged';
      return { id, action, processedAt: new Date().toISOString() };
    },
  );

  app.get('/api/corpus', async () => ({
    ...corpusDashboardData,
    policies: policyConfiguration,
  }));

  app.post(
    '/api/realtime/session',
    { schema: { response: { 200: { type: 'object', additionalProperties: true } } } },
    async () => {
      const payload = VoiceSessionTokenSchema.parse({
        token: randomUUID(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        websocket_url: `wss://realtime.avocat-ai.local/session/${randomUUID()}`,
      });
      return payload;
    },
  );

  app.get('/api/voice/context', async () => voiceConsoleContext);

  app.post(
    '/api/voice/run',
    {
      schema: {
        body: {
          type: 'object',
          properties: { transcript: { type: 'string' } },
          required: ['transcript'],
          additionalProperties: true,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      const parsed = VoiceRunRequestSchema.parse(request.body ?? {});
      const response = buildVoiceRunResponse(parsed.transcript);
      reply.code(201);
      return response;
    },
  );
}
