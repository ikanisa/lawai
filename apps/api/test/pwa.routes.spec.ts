import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AgentRunSchema,
  AgentStreamRequestSchema,
  CitationsBrowserDataSchema,
  CorpusDashboardDataSchema,
  ResearchDeskContextSchema,
  ResearchStreamPayloadSchema,
  HitlQueueDataSchema,
  MattersOverviewSchema,
  PolicyConfigurationSchema,
  UploadResponseSchema,
  VoiceConsoleContextSchema,
  VoiceRunRequestSchema,
  VoiceRunResponseSchema,
  VoiceSessionTokenSchema,
} from '@avocat-ai/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createApp } from '../src/app.js';

describe('PWA agent-first routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('provides a research desk context payload', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/research/context' });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(() => ResearchDeskContextSchema.parse(payload)).not.toThrow();
  });

  it.each([
    {
      mode: 'allowlist' as const,
      tools: ['web_search', 'file_search'],
      expectedDetail: 'Requête ciblée sur le JO OHADA et les bulletins officiels.',
    },
    {
      mode: 'broad' as const,
      tools: ['web_search', 'file_search'],
      expectedDetail: 'Recherche étendue incluant les sources publiques surveillées.',
    },
    {
      mode: 'disabled' as const,
      tools: ['file_search'],
      expectedDetail: null,
    },
  ])('creates a simulated agent run and streams events for %s mode', async ({ mode, tools, expectedDetail }) => {
    const runResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/run',
      payload: {
        input: 'Explique la procédure de résiliation dans un contrat OHADA',
        agent_id: 'research',
        tools_enabled: tools,
        web_search_mode: mode,
      },
    });

    expect(runResponse.statusCode).toBe(200);
    const runPayload = JSON.parse(runResponse.body);
    const run = AgentRunSchema.parse(runPayload);
    expect(run.webSearchMode).toBe(mode);

    const streamRequest = AgentStreamRequestSchema.parse({
      input: 'Explique la procédure de résiliation dans un contrat OHADA',
      agent_id: run.agentId,
      run_id: run.id,
      thread_id: run.threadId,
      tools_enabled: tools,
    });

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/stream',
      payload: streamRequest,
    });

    expect(streamResponse.statusCode).toBe(200);
    const lines = streamResponse.body
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines.at(-1)?.type).toBe('done');
    const streamEvents = lines.slice(0, -1);
    expect(streamEvents.length).toBeGreaterThan(0);

    const parsedEvents = streamEvents.map((event) => {
      expect(typeof event.type).toBe('string');
      if (event.type !== 'done') {
        expect(() => ResearchStreamPayloadSchema.parse(event.data)).not.toThrow();
      }
      return event;
    });

    const webSearchEvents = parsedEvents.filter(
      (event) => event.type === 'tool' && event.data.tool?.name === 'web_search',
    );

    if (expectedDetail) {
      expect(webSearchEvents).not.toHaveLength(0);
      expect(webSearchEvents[0]?.data.tool?.detail).toBe(expectedDetail);
    } else {
      expect(webSearchEvents).toHaveLength(0);
    }
  });

  it('exposes voice console context, session token, and run responses', async () => {
    const contextResponse = await app.inject({ method: 'GET', url: '/api/voice/context' });
    expect(contextResponse.statusCode).toBe(200);
    const contextPayload = JSON.parse(contextResponse.body);
    expect(() => VoiceConsoleContextSchema.parse(contextPayload)).not.toThrow();

    const tokenResponse = await app.inject({ method: 'POST', url: '/api/realtime/session' });
    expect(tokenResponse.statusCode).toBe(200);
    const tokenPayload = JSON.parse(tokenResponse.body);
    expect(() => VoiceSessionTokenSchema.parse(tokenPayload)).not.toThrow();

    const runRequest = VoiceRunRequestSchema.parse({
      agent_id: 'voice-realtime',
      locale: 'fr-FR',
      transcript: 'Nous avons une urgence référé et il faut notifier le DPO.',
      intents: ['intent_deadline'],
      citations: [],
    });

    const runResponse = await app.inject({
      method: 'POST',
      url: '/api/voice/run',
      payload: runRequest,
    });

    expect(runResponse.statusCode).toBe(200);
    const runPayload = JSON.parse(runResponse.body);
    expect(() => VoiceRunResponseSchema.parse(runPayload)).not.toThrow();
  });

  it('serves corpus, citations, matters, hitl, upload, and deadline APIs', async () => {
    const corpusResponse = await app.inject({ method: 'GET', url: '/api/corpus' });
    expect(corpusResponse.statusCode).toBe(200);
    const corpusPayload = JSON.parse(corpusResponse.body);
    const CorpusDashboardResponseSchema = CorpusDashboardDataSchema.extend({
      policies: PolicyConfigurationSchema,
    });
    expect(() => CorpusDashboardResponseSchema.parse(corpusPayload)).not.toThrow();

    const citationsResponse = await app.inject({ method: 'GET', url: '/api/citations' });
    expect(citationsResponse.statusCode).toBe(200);
    const citationsPayload = JSON.parse(citationsResponse.body);
    expect(() => CitationsBrowserDataSchema.parse(citationsPayload)).not.toThrow();

    const mattersResponse = await app.inject({ method: 'GET', url: '/api/matters' });
    expect(mattersResponse.statusCode).toBe(200);
    const mattersPayload = JSON.parse(mattersResponse.body);
    expect(() => MattersOverviewSchema.parse(mattersPayload)).not.toThrow();

    const hitlResponse = await app.inject({ method: 'GET', url: '/api/hitl' });
    expect(hitlResponse.statusCode).toBe(200);
    const hitlPayload = JSON.parse(hitlResponse.body);
    expect(() => HitlQueueDataSchema.parse(hitlPayload)).not.toThrow();

    const hitlActionResponse = await app.inject({
      method: 'POST',
      url: '/api/hitl/hitl_helios_1',
      payload: { action: 'approve' },
    });
    expect(hitlActionResponse.statusCode).toBe(200);
    const hitlActionPayload = JSON.parse(hitlActionResponse.body);
    expect(hitlActionPayload).toMatchObject({ id: 'hitl_helios_1', action: 'approve' });

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/upload',
      payload: {
        filename: 'ohada_decision.pdf',
        jurisdiction: 'OHADA',
        source_type: 'statute',
        hash_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        allowlisted_domain: 'https://ohada.org',
      },
    });
    expect(uploadResponse.statusCode).toBe(200);
    const uploadPayload = JSON.parse(uploadResponse.body);
    expect(() => UploadResponseSchema.parse(uploadPayload)).not.toThrow();

    const deadlineResponse = await app.inject({
      method: 'POST',
      url: '/api/deadline',
      payload: { start_date: new Date('2024-06-01T09:00:00Z').toISOString(), procedure: 'Audience référé' },
    });
    expect(deadlineResponse.statusCode).toBe(200);
    const deadlinePayload = JSON.parse(deadlineResponse.body);
    const DeadlineEntrySchema = z.object({
      id: z.string(),
      label: z.string(),
      computedDate: z.string(),
      daysUntilDue: z.number(),
      rule: z.string(),
      tool: z.enum(['deadlineCalculator', 'calendar_emit']),
    });
    const DeadlineResponseSchema = z.object({
      baseDate: z.string(),
      jurisdiction: z.string(),
      procedure: z.string(),
      deadlines: z.array(DeadlineEntrySchema),
    });
    expect(() => DeadlineResponseSchema.parse(deadlinePayload)).not.toThrow();
  });
});
