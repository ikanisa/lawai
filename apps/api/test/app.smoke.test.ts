import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseStub = { from: vi.fn(), rpc: vi.fn() };

vi.mock('../src/supabase-client.js', () => ({
  supabase: supabaseStub,
}));

const registerWorkspaceRoutes = vi.fn(async () => {});
const registerAgentsRoutes = vi.fn(async () => {});
const registerCitationsRoutes = vi.fn(async () => {});
const registerCorpusRoutes = vi.fn(async () => {});
const registerDeadlineRoutes = vi.fn(async () => {});
const registerHitlRoutes = vi.fn(async () => {});
const registerMattersRoutes = vi.fn(async () => {});
const registerRealtimeRoutes = vi.fn(async () => {});
const registerResearchRoutes = vi.fn(async () => {});
const registerUploadRoutes = vi.fn(async () => {});
const registerVoiceRoutes = vi.fn(async () => {});

vi.mock('../src/domain/workspace/routes', () => ({ registerWorkspaceRoutes }));
vi.mock('../src/routes/agents/index.js', () => ({ registerAgentsRoutes }));
vi.mock('../src/routes/citations/index.js', () => ({ registerCitationsRoutes }));
vi.mock('../src/routes/corpus/index.js', () => ({ registerCorpusRoutes }));
vi.mock('../src/routes/deadline/index.js', () => ({ registerDeadlineRoutes }));
vi.mock('../src/routes/hitl/index.js', () => ({ registerHitlRoutes }));
vi.mock('../src/routes/matters/index.js', () => ({ registerMattersRoutes }));
vi.mock('../src/routes/realtime/index.js', () => ({ registerRealtimeRoutes }));
vi.mock('../src/routes/research/index.js', () => ({ registerResearchRoutes }));
vi.mock('../src/routes/upload/index.js', () => ({ registerUploadRoutes }));
vi.mock('../src/routes/voice/index.js', () => ({ registerVoiceRoutes }));

const { createApp } = await import('../src/app.ts');

const routeRegistrars = [
  registerAgentsRoutes,
  registerResearchRoutes,
  registerCitationsRoutes,
  registerCorpusRoutes,
  registerMattersRoutes,
  registerHitlRoutes,
  registerDeadlineRoutes,
  registerUploadRoutes,
  registerVoiceRoutes,
  registerRealtimeRoutes,
  registerWorkspaceRoutes,
];

describe('createApp', () => {
  beforeEach(() => {
    routeRegistrars.forEach((fn) => fn.mockClear());
  });

  it('registers all core route plugins', async () => {
    const { app, context } = await createApp();

    expect(context.supabase).toBe(supabaseStub);

    routeRegistrars.slice(0, -1).forEach((fn) => {
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0]?.[1]).toBe(context);
    });

    expect(registerWorkspaceRoutes).toHaveBeenCalledTimes(1);
    expect(registerWorkspaceRoutes.mock.calls[0]?.[0]).toBe(app);
    expect(registerWorkspaceRoutes.mock.calls[0]?.[1]).toBe(context);

    await app.close();
  });
});
