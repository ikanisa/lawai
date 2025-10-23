import type { WorkspaceRepository, WorkspaceRunSummary } from '../repositories/workspace-repository.js';

export interface GetWorkspaceSnapshotInput {
  orgId: string;
  limit?: number;
}

export interface WorkspaceSnapshot {
  runs: WorkspaceRunSummary[];
}

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async getWorkspaceSnapshot(input: GetWorkspaceSnapshotInput): Promise<WorkspaceSnapshot> {
    const runs = await this.repository.listRecentRuns(input.orgId, input.limit ?? 25);
    return { runs };
  }
}
