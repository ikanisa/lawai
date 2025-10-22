import { beforeEach, describe, expect, it } from 'vitest';
import { SupabaseScheduler } from '../src/scheduling/scheduler.js';

describe('SupabaseScheduler', () => {
  let inserts: Array<{ table: string; values: Record<string, unknown> }>;
  let updates: Array<{ table: string; values: Record<string, unknown>; eq: { column: string; value: unknown } }>;

  beforeEach(() => {
    inserts = [];
    updates = [];
  });

  function createClient() {
    return {
      from(table: string) {
        return {
          insert(values: Record<string, unknown>) {
            inserts.push({ table, values });
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: 'run-1' }, error: null };
                  },
                };
              },
              async single() {
                return { data: { id: 'run-1' }, error: null };
              },
              error: null,
            } as unknown as Promise<{ data: { id: string }; error: null }>;
          },
          update(values: Record<string, unknown>) {
            return {
              async eq(column: string, value: unknown) {
                updates.push({ table, values, eq: { column, value } });
                return { error: null };
              },
            };
          },
        };
      },
    };
  }

  it('enqueues tasks with defaults', async () => {
    const scheduler = new SupabaseScheduler(createClient());
    await scheduler.enqueueTask({ type: 'ingestion_run', orgId: 'org-1' });
    expect(inserts[0]?.table).toEqual('agent_task_queue');
    expect(inserts[0]?.values).toMatchObject({ type: 'ingestion_run', org_id: 'org-1' });
  });

  it('starts and completes ingestion runs', async () => {
    const client = createClient();
    const scheduler = new SupabaseScheduler(client);
    const record = await scheduler.startIngestionRun('adapter-1', 'org-1');
    expect(record).toEqual({ id: 'run-1' });
    await scheduler.completeIngestionRun(record, {
      adapterId: 'adapter-1',
      orgId: 'org-1',
      status: 'completed',
      insertedCount: 10,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.eq).toEqual({ column: 'id', value: 'run-1' });
  });

  it('throws when ingestion summary insert fails', async () => {
    const scheduler = new SupabaseScheduler({
      from(table: string) {
        return {
          insert() {
            return Promise.resolve({ data: null, error: { message: 'boom' } });
          },
        } as never;
      },
    });

    await expect(
      scheduler.recordIngestionSummary({
        adapterId: 'adapter',
        orgId: 'org',
        status: 'completed',
      }),
    ).rejects.toThrow('Impossible d\'enregistrer le résumé d\'ingestion');
  });
});
