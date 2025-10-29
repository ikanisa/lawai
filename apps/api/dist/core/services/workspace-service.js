export class WorkspaceService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getWorkspaceSnapshot(input) {
        const runs = await this.repository.listRecentRuns(input.orgId, input.limit ?? 25);
        return { runs };
    }
}
