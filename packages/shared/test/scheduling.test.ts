import { describe, expect, it, vi } from 'vitest';
import { createScheduler, type ScheduledTask } from '../src/scheduling.js';

describe('scheduler', () => {
  it('registers and lists tasks', () => {
    const scheduler = createScheduler();
    const task: ScheduledTask = {
      id: 'ingestion-hourly',
      group: 'ingestion',
      description: 'Hourly ingestion run',
      trigger: { kind: 'cron', expression: '0 * * * *', timezone: 'UTC' },
    };

    scheduler.register(task);
    expect(scheduler.list()).toHaveLength(1);
    expect(scheduler.get('ingestion-hourly')).toEqual(task);
  });

  it('executes handlers with default context', async () => {
    const handler = vi.fn();
    const scheduler = createScheduler({ defaultContext: () => ({ foo: 'bar' }) });

    scheduler.register({
      id: 'evaluation',
      group: 'evaluation',
      description: 'Nightly evaluation run',
      trigger: { kind: 'cron', expression: '0 2 * * *' },
      handler,
    });

    await scheduler.run('evaluation');
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('propagates handler errors and calls onError hook', async () => {
    const error = new Error('boom');
    const onError = vi.fn();
    const scheduler = createScheduler({ onError });

    scheduler.register({
      id: 'red-team',
      group: 'red-team',
      description: 'Weekly red-team scenario',
      trigger: { kind: 'cron', expression: '0 6 * * MON' },
      handler: () => {
        throw error;
      },
    });

    await expect(scheduler.run('red-team')).rejects.toThrowError('boom');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ id: 'red-team' }), error);
  });
});
