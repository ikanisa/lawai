export interface WorkspaceRunSummary {
    id: string;
}
export interface WorkspaceRepository {
    listRecentRuns(orgId: string, limit?: number): Promise<WorkspaceRunSummary[]>;
}
//# sourceMappingURL=workspace-repository.d.ts.map