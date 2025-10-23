export type ScheduleTrigger =
  | { kind: 'cron'; expression: string; timezone?: string }
  | { kind: 'queue'; table: string; pollIntervalMs?: number };

export interface ScheduledTask<TContext = unknown> {
  id: string;
  group: string;
  description: string;
  trigger: ScheduleTrigger;
  handler?: (context: TContext) => Promise<void> | void;
  command?: string;
}

export interface Scheduler<TContext = unknown> {
  register(task: ScheduledTask<TContext>): void;
  list(): ScheduledTask<TContext>[];
  get(id: string): ScheduledTask<TContext> | undefined;
  run(id: string, context?: TContext): Promise<void>;
}

interface SchedulerOptions<TContext> {
  defaultContext?: () => TContext;
  onRegister?: (task: ScheduledTask<TContext>) => void;
  onError?: (task: ScheduledTask<TContext>, error: unknown) => void;
}

export function createScheduler<TContext = unknown>(
  options: SchedulerOptions<TContext> = {},
): Scheduler<TContext> {
  const tasks = new Map<string, ScheduledTask<TContext>>();

  function register(task: ScheduledTask<TContext>) {
    if (tasks.has(task.id)) {
      throw new Error(`Scheduled task with id ${task.id} already registered`);
    }
    tasks.set(task.id, task);
    options.onRegister?.(task);
  }

  async function run(id: string, context?: TContext) {
    const task = tasks.get(id);
    if (!task) {
      throw new Error(`Unknown scheduled task: ${id}`);
    }
    if (!task.handler) {
      return;
    }
    const ctx = context ?? options.defaultContext?.();
    try {
      await task.handler(ctx as TContext);
    } catch (error) {
      options.onError?.(task, error);
      throw error;
    }
  }

  function list(): ScheduledTask<TContext>[] {
    return Array.from(tasks.values());
  }

  function get(id: string) {
    return tasks.get(id);
  }

  return { register, list, get, run };
}
