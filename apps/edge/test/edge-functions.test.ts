import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

type EdgeHandler = (request: Request, info: unknown) => Response | Promise<Response>;
type DenoShim = {
  env: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
  };
  serve: (handler: EdgeHandler) => unknown;
};

const EDGE_SECRET = 'test-edge-secret';
const MODULES = [
  { name: 'case-recompute', specifier: '../case-recompute/index.ts' },
  { name: 'drive-watcher', specifier: '../drive-watcher/index.ts' },
  { name: 'gdrive-watcher', specifier: '../gdrive-watcher/index.ts' },
  { name: 'evaluate-and-gate', specifier: '../evaluate-and-gate/index.ts' },
  { name: 'learning-collector', specifier: '../learning-collector/index.ts' },
  { name: 'crawl-authorities', specifier: '../crawl-authorities/index.ts' },
  { name: 'learning-diagnoser', specifier: '../learning-diagnoser/index.ts' },
  { name: 'learning-applier', specifier: '../learning-applier/index.ts' },
  { name: 'provenance-alerts', specifier: '../provenance-alerts/index.ts' },
  { name: 'regulator-digest', specifier: '../regulator-digest/index.ts' },
  { name: 'gdrive-delta', specifier: '../gdrive-delta/index.ts' },
  { name: 'transparency-digest', specifier: '../transparency-digest/index.ts' },
  { name: 'link-health', specifier: '../link-health/index.ts' },
  { name: 'process-learning', specifier: '../process-learning/index.ts' },
];

const handlers = new Map<string, EdgeHandler>();
const envStore = new Map<string, string>();
let currentModule: string | null = null;

const serveSpy = vi.fn((handler: EdgeHandler) => {
  if (!currentModule) {
    throw new Error('No module specifier set before invoking Deno.serve');
  }
  handlers.set(currentModule, handler);
  return {} as unknown;
});

// Provide a minimal Deno shim for the modules under test.
const denoShim: DenoShim = {
  env: {
    get(key: string) {
      return envStore.get(key);
    },
    set(key: string, value: string) {
      envStore.set(key, value);
    },
    delete(key: string) {
      envStore.delete(key);
    },
  },
  serve: serveSpy,
};

(globalThis as { Deno?: DenoShim }).Deno = denoShim;

if (typeof fetch === 'undefined') {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => new Response(null, { status: 200 }));
} else {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function registerMocks() {
  vi.doMock('../lib/supabase.ts', () => ({
    createEdgeClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: null, error: null })) })) })) })) })),
        })),
        insert: vi.fn(() => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
        upsert: vi.fn(() => ({ error: null })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
        order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [] })) })),
        maybeSingle: vi.fn(() => ({ data: null, error: null })),
      })),
    })),
    rowsAs: <T>(rows: readonly unknown[] | null | undefined) => (Array.isArray(rows) ? (rows as T[]) : []),
    rowAs: <T>(row: Record<string, unknown> | null | undefined) => (row ? (row as unknown as T) : null),
  }));

  vi.doMock('../lib/openai.ts', () => ({
    createOpenAIDenoClient: vi.fn(() => ({
      responses: {
        create: vi.fn(async () => ({ output: [] })),
      },
    })),
  }));

  vi.doMock('../lib/akoma.ts', () => ({
    buildAkomaBodyFromText: vi.fn(() => ({})),
    extractCaseTreatmentHints: vi.fn(() => []),
    extractPlainTextFromBuffer: vi.fn(() => ''),
  }));

  vi.doMock(resolve(__dirname, '../../packages/shared/src/scheduling/scheduler.ts'), () => ({
    SupabaseScheduler: class {
      async enqueue() {
        return { error: null };
      }
      async schedule() {
        return { error: null };
      }
    },
  }));

  vi.doMock('npm:@avocat-ai/shared/transparency', () => ({
    formatTransparencyDigest: vi.fn(() => ''),
  }));

  vi.doMock(resolve(__dirname, '../../packages/shared/src/transparency/digest.ts'), () => ({
    formatTransparencyDigest: vi.fn(() => ''),
  }));
}

async function importHandler(specifier: string): Promise<EdgeHandler> {
  vi.resetModules();
  registerMocks();
  currentModule = specifier;
  await import(specifier);
  const handler = handlers.get(specifier);
  if (!handler) {
    throw new Error(`No handler registered for ${specifier}`);
  }
  return handler;
}

beforeAll(() => {
  envStore.set('EDGE_FUNCTION_SECRET', EDGE_SECRET);
  envStore.set('EDGE_FUNCTION_TEST_MODE', 'true');
});

describe('edge function authentication', () => {
  for (const module of MODULES) {
    describe(module.name, () => {
      let handler: EdgeHandler;

      beforeAll(async () => {
        handler = await importHandler(module.specifier);
      });

      it('responds with 401 when credentials are missing', async () => {
        const response = await handler(new Request('https://edge.test'), {});
        expect(response.status).toBe(401);
      });

      it('responds with 200 when provided a valid secret', async () => {
        const headers = new Headers({
          authorization: `Bearer ${EDGE_SECRET}`,
          'x-edge-test-auth-only': 'true',
        });
        const response = await handler(new Request('https://edge.test', { headers }), {});
        expect(response.status).toBe(200);
      });
    });
  }
});
