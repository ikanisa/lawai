import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceService } from './services/workspace-service.js';
import { OrchestratorController } from './controllers/orchestrator-controller.js';
import { WorkspaceController } from './controllers/workspace-controller.js';
import type { OrchestratorAIGateway, OrchestratorRepository } from './repositories/orchestrator-repository.js';
import type { WorkspaceRepository } from './repositories/workspace-repository.js';
export interface AppContainerOverrides {
    orchestratorRepository?: OrchestratorRepository;
    orchestratorAIGateway?: OrchestratorAIGateway;
    workspaceRepository?: WorkspaceRepository;
    workspaceServiceFactory?: (repository: WorkspaceRepository) => WorkspaceService;
}
export declare class AppContainer {
    private readonly supabase;
    readonly orchestrator: OrchestratorController;
    readonly workspace: WorkspaceController;
    private readonly disposers;
    constructor(supabase: SupabaseClient, overrides?: AppContainerOverrides);
    registerDisposer(disposer: () => Promise<void> | void): void;
    dispose(): Promise<void>;
}
export interface CreateContainerOptions extends AppContainerOverrides {
    supabase: SupabaseClient;
}
export declare function createAppContainer(options: CreateContainerOptions): AppContainer;
//# sourceMappingURL=container.d.ts.map