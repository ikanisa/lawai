import { describe, expect, it, vi } from 'vitest';
import type { SpinnerLike } from '../src/lib/cli.js';
import { runOpsCli } from '../src/lib/cli.js';

function createSpinner(): SpinnerLike {
  return {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  };
}

describe('ops CLI', () => {
  it('retrieves jurisdictions with retries', async () => {
    const spinner = createSpinner();
    let attempt = 0;
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          limit() {
            attempt += 1;
            if (attempt < 2) {
              return Promise.resolve({ data: null, error: { message: 'temporary failure' } });
            }
            return Promise.resolve({ data: [{ code: 'FR', name: 'France' }], error: null });
          },
        };
      },
    };

    const output: Array<string | unknown[]> = [];
    const result = await runOpsCli(['--retries', '2'], {
      env: { SUPABASE_URL: 'http://example', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
      createClient: () => supabase as never,
      spinnerFactory: () => spinner,
      sleep: () => Promise.resolve(),
      out: {
        log: (...args: unknown[]) => {
          output.push(args.join(' '));
        },
        error: vi.fn(),
        table: (rows: unknown) => {
          output.push(rows as unknown[]);
        },
      },
      now: () => new Date('2024-05-05T12:00:00Z'),
    });

    expect(result).toBe(0);
    expect(output.some((entry) => Array.isArray(entry))).toBe(true);
    expect(output.join(' ')).toContain('Dernière exécution: 2024-05-05T12:00:00.000Z');
  });

  it('schedules ingestion tasks', async () => {
    const spinner = createSpinner();
    const scheduleIngestion = vi.fn();
    const scheduler = { scheduleIngestion, scheduleRedTeam: vi.fn(), scheduleEvaluation: vi.fn() };

    const result = await runOpsCli(['--schedule', 'ingestion', '--org', 'org-1', '--adapter', 'adapter-1'], {
      env: { SUPABASE_URL: 'http://example', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
      createClient: () => ({} as never),
      schedulerFactory: () => scheduler as never,
      spinnerFactory: () => spinner,
      out: {
        log: vi.fn(),
        error: vi.fn(),
        table: vi.fn(),
      },
    });

    expect(result).toBe(0);
    expect(scheduleIngestion).toHaveBeenCalledWith('org-1', 'adapter-1');
  });

  it('surfaces configuration errors', async () => {
    const spinner = createSpinner();
    const errors: string[] = [];
    const result = await runOpsCli(['--schedule', 'ingestion'], {
      env: { SUPABASE_URL: 'http://example', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
      createClient: () => ({} as never),
      schedulerFactory: () => ({ scheduleIngestion: vi.fn(), scheduleRedTeam: vi.fn(), scheduleEvaluation: vi.fn() } as never),
      spinnerFactory: () => spinner,
      out: {
        log: vi.fn(),
        error: (...args: string[]) => {
          errors.push(args.join(' '));
        },
        table: vi.fn(),
      },
    });

    expect(result).toBe(1);
    expect(errors.join(' ')).toContain('organisation');
  });
});
