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
} from './avocat-pwa-data.js';

interface StreamEvent {
  type: 'token' | 'tool' | 'citation' | 'risk' | 'done';
  data: Partial<ResearchStreamPayload> & {
    tool?: ResearchStreamPayload['tool'];
    citation?: ResearchStreamPayload['citation'];
  };
}

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
            id: parsed.tools_enabled[0] ?? 'lookupCodeArticle',
            name: parsed.tools_enabled[0] ?? 'lookupCodeArticle',
            status: 'running',
            detail: researchToolSummaries.lookupCodeArticle.start,
            planStepId: 'step-intake',
          },
        },
      },
      {
        type: 'tool',
        data: {
          tool: {
            id: 'web_search',
            name: 'web_search',
            status: 'running',
            detail: researchToolSummaries.web_search.start,
            planStepId: 'step-risk',
          },
        },
      },
    ];

    const tokenEvents: StreamEvent[] = researchAnswerChunks.map((chunk) => ({
      type: 'token',
      data: { token: `${chunk} ` },
    }));

    const citationEvents: StreamEvent[] = researchDeskContext.defaultCitations.slice(0, 2).map((citation: any) => ({
      type: 'citation',
      data: { citation },
    }));

    const completionEvents: StreamEvent[] = [
      {
        type: 'tool',
        data: {
          tool: {
            id: parsed.tools_enabled[0] ?? 'lookupCodeArticle',
            name: parsed.tools_enabled[0] ?? 'lookupCodeArticle',
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
            id: 'web_search',
            name: 'web_search',
            status: 'success',
            detail: researchToolSummaries.web_search.success,
            planStepId: 'step-risk',
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
