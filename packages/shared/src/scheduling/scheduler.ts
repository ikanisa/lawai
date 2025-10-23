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
  error: { message: string } | null;
}

export interface SupabaseUpdateResult {
  error: { message: string } | null;
}

export interface SupabaseQueryBuilder<T = unknown> {
  select(columns: string): SupabaseQueryBuilder<T>;
  single(): Promise<SupabaseInsertResult<T>>;
}

export interface SupabaseTable<T = unknown> {
  insert(values: unknown): SupabaseQueryBuilder<T> & Promise<SupabaseInsertResult<T>>;
  update(values: unknown): { eq(column: string, value: unknown): Promise<SupabaseUpdateResult> };
}

export interface SupabaseLike {
  from<T>(table: string): SupabaseTable<T>;
}

export class SupabaseScheduler<Client extends SupabaseLike = SupabaseLike> {
  constructor(private readonly client: Client) {}

  async enqueueTask(task: QueueTaskInput): Promise<void> {
    const insertPayload = {
      type: task.type,
      org_id: task.orgId ?? null,
      payload: task.payload ?? null,
      priority: task.priority ?? 5,
      scheduled_at: task.scheduledAt ?? new Date().toISOString(),
      status: 'scheduled',
    };

    const result = (await this.client
      .from('agent_task_queue')
      .insert(insertPayload)) as unknown as SupabaseInsertResult;

    if (result.error) {
      throw new Error(`Impossible d'enregistrer la tâche ${task.type}: ${result.error.message}`);
    }
  }

  async scheduleIngestion(orgId: string, adapterId: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.enqueueTask({ type: 'ingestion_run', orgId, payload: { adapterId, ...payload } });
  }

  async scheduleRedTeam(orgId: string, scenarioKey: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.enqueueTask({ type: 'red_team_run', orgId, payload: { scenarioKey, ...payload }, priority: 7 });
  }

  async scheduleEvaluation(orgId: string, benchmark: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.enqueueTask({ type: 'evaluation_run', orgId, payload: { benchmark, ...payload }, priority: 6 });
  }

  async startIngestionRun(adapterId: string, orgId: string): Promise<{ id: string } | null> {
    const insertBuilder = this.client
      .from('ingestion_runs')
      .insert({
        adapter_id: adapterId,
        org_id: orgId,
        status: 'running',
        started_at: new Date().toISOString(),
      }) as unknown as SupabaseQueryBuilder<{ id: string }>;

    const result = await insertBuilder.select('id').single();

    if (result.error) {
      console.warn(`Unable to record ingestion start for ${adapterId}:`, result.error.message);
      return null;
    }

    return { id: (result.data as { id: string }).id };
  }

  async completeIngestionRun(
    record: { id: string } | null,
    summary: IngestionRunSummary,
  ): Promise<void> {
    if (!record) {
      return;
    }

    const updatePayload = {
      status: summary.status,
      inserted_count: summary.insertedCount ?? null,
      skipped_count: summary.skippedCount ?? null,
      failed_count: summary.failedCount ?? null,
      finished_at: new Date().toISOString(),
      error_message: summary.errorMessage ?? null,
    };

    const result = await this.client
      .from('ingestion_runs')
      .update(updatePayload)
      .eq('id', record.id);

    if (result.error) {
      console.warn(`Unable to finalise ingestion run ${record.id}:`, result.error.message);
    }
  }

  async recordIngestionSummary(summary: IngestionRunSummary): Promise<void> {
    const insertResult = (await this.client.from('ingestion_runs').insert({
      org_id: summary.orgId,
      adapter_id: summary.adapterId,
      status: summary.status,
      inserted_count: summary.insertedCount ?? null,
      skipped_count: summary.skippedCount ?? null,
      failed_count: summary.failedCount ?? null,
      finished_at: new Date().toISOString(),
      error_message: summary.errorMessage ?? null,
    })) as unknown as SupabaseInsertResult;

    if (insertResult.error) {
      throw new Error(`Impossible d'enregistrer le résumé d'ingestion: ${insertResult.error.message}`);
    }
  }
}
