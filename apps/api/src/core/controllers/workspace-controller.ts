import type { WorkspaceService } from '../services/workspace-service.js';
import type { WorkspaceSnapshot } from '../services/workspace-service.js';

export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  async getWorkspace(orgId: string): Promise<WorkspaceSnapshot> {
    return this.service.getWorkspaceSnapshot({ orgId });
  }
}
