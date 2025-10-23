import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceRepository, WorkspaceRunSummary } from '../../repositories/workspace-repository.js';

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRecentRuns(orgId: string, limit = 25): Promise<WorkspaceRunSummary[]> {
    const query = await this.client
      .from('agent_runs')
      .select('id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (query.error) {
      throw new Error(query.error.message);
    }

    const rows = Array.isArray(query.data) ? (query.data as Array<Record<string, unknown>>) : [];
    return rows
      .map((row) => ({ id: typeof row.id === 'string' ? row.id : row.id ? String(row.id) : '' }))
      .filter((row): row is WorkspaceRunSummary => Boolean(row.id));
  }
}
