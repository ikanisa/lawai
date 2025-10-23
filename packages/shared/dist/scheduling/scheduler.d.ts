export interface QueueTaskInput {
    type: string;
    orgId?: string | null;
    payload?: Record<string, unknown> | null;
    priority?: number | null;
    scheduledAt?: string | null;
}
export interface IngestionRunSummary {
    adapterId: string;
    orgId: string;
    status: 'running' | 'completed' | 'failed';
    insertedCount?: number;
    skippedCount?: number;
    failedCount?: number;
    errorMessage?: string | null;
}
export interface SupabaseInsertResult<T = unknown> {
    data: T | null;
    error: {
        message: string;
    } | null;
}
export interface SupabaseUpdateResult {
    error: {
        message: string;
    } | null;
}
export interface SupabaseQueryBuilder<T = unknown> {
    select(columns: string): SupabaseQueryBuilder<T>;
    single(): Promise<SupabaseInsertResult<T>>;
}
export interface SupabaseTable<T = unknown> {
    insert(values: unknown): SupabaseQueryBuilder<T> & Promise<SupabaseInsertResult<T>>;
    update(values: unknown): {
        eq(column: string, value: unknown): Promise<SupabaseUpdateResult>;
    };
}
export interface SupabaseLike {
    from<T>(table: string): SupabaseTable<T>;
}
export declare class SupabaseScheduler<Client extends SupabaseLike = SupabaseLike> {
    private readonly client;
    constructor(client: Client);
    enqueueTask(task: QueueTaskInput): Promise<void>;
    scheduleIngestion(orgId: string, adapterId: string, payload?: Record<string, unknown>): Promise<void>;
    scheduleRedTeam(orgId: string, scenarioKey: string, payload?: Record<string, unknown>): Promise<void>;
    scheduleEvaluation(orgId: string, benchmark: string, payload?: Record<string, unknown>): Promise<void>;
    startIngestionRun(adapterId: string, orgId: string): Promise<{
        id: string;
    } | null>;
    completeIngestionRun(record: {
        id: string;
    } | null, summary: IngestionRunSummary): Promise<void>;
    recordIngestionSummary(summary: IngestionRunSummary): Promise<void>;
}
//# sourceMappingURL=scheduler.d.ts.map