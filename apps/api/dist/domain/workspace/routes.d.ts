import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { fetchWorkspaceOverview as defaultFetchWorkspaceOverview } from './services.js';
type WorkspaceServices = {
    fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};
export declare function registerWorkspaceRoutes(app: AppFastifyInstance, ctx: AppContext, services?: Partial<WorkspaceServices>): Promise<void>;
export {};
//# sourceMappingURL=routes.d.ts.map