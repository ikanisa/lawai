export class SupabaseScheduler {
    client;
    constructor(client) {
        this.client = client;
    }
    async enqueueTask(task) {
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
            .insert(insertPayload));
        if (result.error) {
            throw new Error(`Impossible d'enregistrer la tâche ${task.type}: ${result.error.message}`);
        }
    }
    async scheduleIngestion(orgId, adapterId, payload = {}) {
        await this.enqueueTask({ type: 'ingestion_run', orgId, payload: { adapterId, ...payload } });
    }
    async scheduleRedTeam(orgId, scenarioKey, payload = {}) {
        await this.enqueueTask({ type: 'red_team_run', orgId, payload: { scenarioKey, ...payload }, priority: 7 });
    }
    async scheduleEvaluation(orgId, benchmark, payload = {}) {
        await this.enqueueTask({ type: 'evaluation_run', orgId, payload: { benchmark, ...payload }, priority: 6 });
    }
    async startIngestionRun(adapterId, orgId) {
        const insertBuilder = this.client
            .from('ingestion_runs')
            .insert({
            adapter_id: adapterId,
            org_id: orgId,
            status: 'running',
            started_at: new Date().toISOString(),
        });
        const result = await insertBuilder.select('id').single();
        if (result.error) {
            console.warn(`Unable to record ingestion start for ${adapterId}:`, result.error.message);
            return null;
        }
        return { id: result.data.id };
    }
    async completeIngestionRun(record, summary) {
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
    async recordIngestionSummary(summary) {
        const insertResult = (await this.client.from('ingestion_runs').insert({
            org_id: summary.orgId,
            adapter_id: summary.adapterId,
            status: summary.status,
            inserted_count: summary.insertedCount ?? null,
            skipped_count: summary.skippedCount ?? null,
            failed_count: summary.failedCount ?? null,
            finished_at: new Date().toISOString(),
            error_message: summary.errorMessage ?? null,
        }));
        if (insertResult.error) {
            throw new Error(`Impossible d'enregistrer le résumé d'ingestion: ${insertResult.error.message}`);
        }
    }
}
