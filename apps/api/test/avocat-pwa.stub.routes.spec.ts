import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AgentRunRequestSchema,
  AgentRunSchema,
  AgentStreamRequestSchema,
} from '@avocat-ai/shared/pwa';
import type { FastifyInstance } from 'fastify';
import { registerAvocatPwaRoutes } from '../src/avocat-pwa.js';

describe('registerAvocatPwaRoutes (stub)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    registerAvocatPwaRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const baseRunPayload = {
    agent_id: 'research',
    input: 'Analyse sur les sources officielles',
    tools_enabled: ['web_search', 'file_search'],
  } as const;

  const baseStreamPayload = {
    agent_id: 'research',
    run_id: 'run_test',
    thread_id: 'thread_test',
    input: 'Analyse sur les sources officielles',
    tools_enabled: ['web_search', 'file_search'],
  } as const;

  function parseEvents(body: string) {
    return body
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }

  it('threads the requested web search mode through the run response', async () => {
    const defaultRunRequest = AgentRunRequestSchema.parse(baseRunPayload);
    const defaultRunResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/run',
      payload: defaultRunRequest,
    });

    expect(defaultRunResponse.statusCode).toBe(201);
    const defaultRun = AgentRunSchema.parse(JSON.parse(defaultRunResponse.body));
    expect(defaultRun.webSearchMode).toBe('allowlist');

    const broadRunRequest = AgentRunRequestSchema.parse({
      ...baseRunPayload,
      web_search_mode: 'broad',
    });

    const broadRunResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/run',
      payload: broadRunRequest,
    });

    expect(broadRunResponse.statusCode).toBe(201);
    const broadRun = AgentRunSchema.parse(JSON.parse(broadRunResponse.body));
    expect(broadRun.webSearchMode).toBe('broad');
  });

  it('emits allowlist copy for web search events by default', async () => {
    const streamRequest = AgentStreamRequestSchema.parse(baseStreamPayload);

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/stream',
      payload: streamRequest,
    });

    expect(streamResponse.statusCode).toBe(200);
    const events = parseEvents(streamResponse.body);
    const webSearchEvents = events.filter(
      (event) => event.type === 'tool' && event.data.tool?.name === 'web_search',
    );

    expect(webSearchEvents).toHaveLength(2);
    expect(webSearchEvents.map((event) => event.data.tool.status)).toEqual([
      'running',
      'success',
    ]);
    expect(webSearchEvents.map((event) => event.data.tool.detail)).toEqual([
      'Requête ciblée sur le JO OHADA et les bulletins officiels.',
      'Sources publiques vérifiées et ajoutées aux preuves.',
    ]);
  });

  it('emits the broad-mode copy when requested', async () => {
    const streamRequest = AgentStreamRequestSchema.parse({
      ...baseStreamPayload,
      web_search_mode: 'broad',
    });

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/stream',
      payload: streamRequest,
    });

    expect(streamResponse.statusCode).toBe(200);
    const events = parseEvents(streamResponse.body);
    const webSearchEvents = events.filter(
      (event) => event.type === 'tool' && event.data.tool?.name === 'web_search',
    );

    expect(webSearchEvents).toHaveLength(2);
    expect(webSearchEvents.map((event) => event.data.tool.detail)).toEqual([
      'Recherche web élargie sur les domaines publics surveillés.',
      'Résultats open web ajoutés avec bannière de prudence.',
    ]);
  });

  it('skips web search events when the mode is disabled', async () => {
    const streamRequest = AgentStreamRequestSchema.parse({
      ...baseStreamPayload,
      web_search_mode: 'disabled',
    });

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/stream',
      payload: streamRequest,
    });

    expect(streamResponse.statusCode).toBe(200);
    const events = parseEvents(streamResponse.body);
    const webSearchEvents = events.filter(
      (event) => event.type === 'tool' && event.data.tool?.name === 'web_search',
    );

    expect(webSearchEvents).toHaveLength(0);
  });

  it('skips web search events when the tool is not enabled', async () => {
    const streamRequest = AgentStreamRequestSchema.parse({
      ...baseStreamPayload,
      tools_enabled: ['file_search'],
      web_search_mode: 'broad',
    });

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/agents/stream',
      payload: streamRequest,
    });

    expect(streamResponse.statusCode).toBe(200);
    const events = parseEvents(streamResponse.body);
    const webSearchEvents = events.filter(
      (event) => event.type === 'tool' && event.data.tool?.name === 'web_search',
    );

    expect(webSearchEvents).toHaveLength(0);
  });
});
