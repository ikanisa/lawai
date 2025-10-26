import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOrchestratorRoutes } from '../../src/http/routes/orchestrator.js';
import { observabilityPlugin } from '../../src/core/observability/observability-plugin.js';
import { getCounterSnapshot, resetCounters } from '../../src/observability/metrics.js';
import type { ControllerResponse } from '../../src/core/controllers/orchestrator-controller.js';

vi.mock('../../src/http/authorization.js', () => ({
  authorizeRequestWithGuards: vi.fn(),
}));

const { authorizeRequestWithGuards } = await import('../../src/http/authorization.js');

describe('orchestrator route instrumentation', () => {
  beforeEach(() => {
    resetCounters();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

const defaultController = {
  listSessionCommands: vi.fn(async () => ({ status: 200, body: { commands: [] } } satisfies ControllerResponse)),
  createCommand: vi.fn(async () =>
    ({
      status: 202,
        body: {
          commandId: 'cmd-1',
          jobId: 'job-1',
          sessionId: 'session-1',
          status: 'queued',
          scheduledFor: new Date().toISOString(),
        },
      } satisfies ControllerResponse),
    ),
    getCapabilities: vi.fn(async () => ({ status: 200, body: {} } satisfies ControllerResponse)),
    registerConnector: vi.fn(async () => ({ status: 201, body: { connectorId: 'conn-1' } } satisfies ControllerResponse)),
    claimJob: vi.fn(async () => ({ status: 204 } satisfies ControllerResponse)),
    getJob: vi.fn(async () => null),
    completeJob: vi.fn(async () => ({ status: 200, body: { status: 'completed' } } satisfies ControllerResponse)),
  } as const;

function createContext(controllerOverrides: Partial<Record<keyof typeof defaultController, any>> = {}) {
  const controller: typeof defaultController = {
    ...defaultController,
    ...controllerOverrides,
  };
  return {
    context: {
      supabase: {} as any,
      container: { orchestrator: controller } as any,
      config: { openai: { apiKey: 'test-key' } },
      rateLimits: {},
    },
    controller,
  };
}

  function buildLogger() {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => logger),
    };
    return logger;
  }

  async function buildApp(controllerOverrides: Partial<Record<keyof typeof defaultController, any>> = {}) {
    const app = Fastify({ logger: false });
    (app.log as any) = buildLogger();
    await app.register(observabilityPlugin);
    const { context } = createContext(controllerOverrides);
    registerOrchestratorRoutes(app, context);
    return app;
  }

  it('records telemetry counters for successful command creation', async () => {
    vi.mocked(authorizeRequestWithGuards).mockResolvedValue({ orgId: 'org-1', userId: 'user-1', role: 'admin', policies: {} });
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: { orgId: 'org-1', commandType: 'finance.sync' },
    });

    expect(response.statusCode).toBe(202);
    const snapshot = getCounterSnapshot();
    expect(
      snapshot.some(
        (entry) => entry.key.includes('route=/agent/commands') && entry.key.includes('status=202') && entry.value === 1,
      ),
    ).toBe(true);

    await app.close();
  });

  it('propagates timeout guard responses and counts them in telemetry', async () => {
    const guardEvents: string[] = [];
    vi.mocked(authorizeRequestWithGuards).mockImplementation(async () => {
      guardEvents.push('timeout');
      const error = new Error('timeout_guard');
      (error as any).statusCode = 408;
      throw error;
    });

    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: { orgId: 'org-1', commandType: 'finance.sync' },
    });

    expect(response.statusCode).toBe(408);
    expect(response.json()).toEqual({ error: 'timeout_guard' });
    expect(guardEvents).toEqual(['timeout']);
    const snapshot = getCounterSnapshot();
    expect(
      snapshot.some(
        (entry) => entry.key.includes('route=/agent/commands') && entry.key.includes('status=408') && entry.value === 1,
      ),
    ).toBe(true);

    await app.close();
  });
});
