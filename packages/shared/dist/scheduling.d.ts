export type ScheduleTrigger = {
    kind: 'cron';
    expression: string;
    timezone?: string;
} | {
    kind: 'queue';
    table: string;
    pollIntervalMs?: number;
};
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
export declare function createScheduler<TContext = unknown>(options?: SchedulerOptions<TContext>): Scheduler<TContext>;
export {};
//# sourceMappingURL=scheduling.d.ts.map