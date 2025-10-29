export class SupabaseWorkspaceRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async listRecentRuns(orgId, limit = 25) {
        const query = await this.client
            .from('agent_runs')
            .select('id')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (query.error) {
            throw new Error(query.error.message);
        }
        const rows = Array.isArray(query.data) ? query.data : [];
        return rows
            .map((row) => ({ id: typeof row.id === 'string' ? row.id : row.id ? String(row.id) : '' }))
            .filter((row) => Boolean(row.id));
    }
}
