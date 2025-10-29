import type { WorkspaceService } from '../services/workspace-service.js';
import type { WorkspaceSnapshot } from '../services/workspace-service.js';
export declare class WorkspaceController {
    private readonly service;
    constructor(service: WorkspaceService);
    getWorkspace(orgId: string): Promise<WorkspaceSnapshot>;
}
//# sourceMappingURL=workspace-controller.d.ts.map