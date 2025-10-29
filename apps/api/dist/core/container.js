import { SupabaseOrchestratorRepository } from './infrastructure/supabase/orchestrator-repository.js';
import { SupabaseWorkspaceRepository } from './infrastructure/supabase/workspace-repository.js';
import { OpenAIOrchestratorGateway } from './infrastructure/openai/orchestrator-ai-gateway.js';
import { OrchestratorService } from './services/orchestrator-service.js';
import { WorkspaceService } from './services/workspace-service.js';
import { OrchestratorController } from './controllers/orchestrator-controller.js';
import { WorkspaceController } from './controllers/workspace-controller.js';
export class AppContainer {
    supabase;
    orchestrator;
    workspace;
    disposers = [];
    constructor(supabase, overrides = {}) {
        this.supabase = supabase;
        const orchestratorRepository = overrides.orchestratorRepository ?? new SupabaseOrchestratorRepository(this.supabase);
        const orchestratorAIGateway = overrides.orchestratorAIGateway ?? new OpenAIOrchestratorGateway(this.supabase);
        const orchestratorService = new OrchestratorService(orchestratorRepository, orchestratorAIGateway);
        this.orchestrator = new OrchestratorController(orchestratorService);
        const workspaceRepository = overrides.workspaceRepository ?? new SupabaseWorkspaceRepository(this.supabase);
        const workspaceServiceFactory = overrides.workspaceServiceFactory ?? ((repository) => new WorkspaceService(repository));
        const workspaceService = workspaceServiceFactory(workspaceRepository);
        this.workspace = new WorkspaceController(workspaceService);
    }
    registerDisposer(disposer) {
        this.disposers.push(disposer);
    }
    async dispose() {
        for (const disposer of this.disposers.splice(0)) {
            await disposer();
        }
    }
}
export function createAppContainer(options) {
    return new AppContainer(options.supabase, options);
}
