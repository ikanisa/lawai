export class WorkspaceController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getWorkspace(orgId) {
        return this.service.getWorkspaceSnapshot({ orgId });
    }
}
