import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { AgentRunSchema, AgentRunRequestSchema, AgentStreamRequestSchema, type AgentRun, type ResearchStreamEvent, ResearchStreamPayloadSchema } from '@avocat-ai/shared';
import type { AppContext } from '../../types/context.js';
import { createResearchStream } from '../research/data.js';

interface SimulatedRun {
  run: AgentRun;
  events: ResearchStreamEvent[];
  createdAt: number;
}

const MAX_RUNS_STORED = 50;
const runStore = new Map<string, SimulatedRun>();
const runOrder: string[] = [];

function persistRun(runId: string, payload: SimulatedRun) {
  runStore.set(runId, payload);
  runOrder.push(runId);
  if (runOrder.length > MAX_RUNS_STORED) {
    const oldest = runOrder.shift();
    if (oldest) {
      runStore.delete(oldest);
    }
  }
}

export async function registerAgentsRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.post('/agents/run', async (request, reply) => {
    const parse = AgentRunRequestSchema.safeParse(request.body ?? {});
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parse.error.flatten() });
    }

    const body = parse.data;
    const now = new Date().toISOString();
    const runId = randomUUID();
    const threadId = randomUUID();
    const run: AgentRun = AgentRunSchema.parse({
      id: runId,
      agentId: body.agent_id,
      threadId,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      input: body.input,
      jurisdiction: body.jurisdiction ?? null,
      policyFlags: body.policy_flags ?? [],
      webSearchMode: body.web_search_mode ?? 'allowlist'
    });

    const events = createResearchStream(body.input, body.tools_enabled ?? [], run.webSearchMode);
    persistRun(runId, { run, events, createdAt: Date.now() });

    return run;
  });

  app.post('/agents/stream', async (request, reply) => {
    const parse = AgentStreamRequestSchema.safeParse(request.body ?? {});
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parse.error.flatten() });
    }

    const body = parse.data;
    const stored = runStore.get(body.run_id);
    if (!stored || stored.run.agentId !== body.agent_id) {
      return reply.code(404).send({ error: 'run_not_found' });
    }

    let aborted = false;
    request.raw.on('close', () => {
      aborted = true;
    });

    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');
    reply.hijack();

    const events = [...stored.events, { type: 'done', data: {} }] as ResearchStreamEvent[];

    for (const event of events) {
      if (aborted) {
        break;
      }
      if (event.type !== 'done') {
        const validation = ResearchStreamPayloadSchema.safeParse(event.data);
        if (!validation.success) {
          app.log.warn({ err: validation.error, eventType: event.type }, 'invalid_stream_payload');
          continue;
        }
      }
      reply.raw.write(`${JSON.stringify(event)}\n`);
      // Slow down the stream slightly to mirror SSE token flow
      await delay(120);
    }

    if (!aborted) {
      const nextRun: AgentRun = {
        ...stored.run,
        status: 'succeeded',
        updatedAt: new Date().toISOString()
      };
      runStore.set(stored.run.id, { ...stored, run: nextRun });
      reply.raw.end();
    }
  });
}
