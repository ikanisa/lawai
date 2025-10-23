import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrchestratorRepository } from './infrastructure/supabase/orchestrator-repository.js';
import { SupabaseWorkspaceRepository } from './infrastructure/supabase/workspace-repository.js';
import { OpenAIOrchestratorGateway } from './infrastructure/openai/orchestrator-ai-gateway.js';
import { OrchestratorService } from './services/orchestrator-service.js';
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

export class AppContainer {
  public readonly orchestrator: OrchestratorController;
  public readonly workspace: WorkspaceController;
  private readonly disposers: Array<() => Promise<void> | void> = [];

  constructor(private readonly supabase: SupabaseClient, overrides: AppContainerOverrides = {}) {
    const orchestratorRepository = overrides.orchestratorRepository ?? new SupabaseOrchestratorRepository(this.supabase);
    const orchestratorAIGateway = overrides.orchestratorAIGateway ?? new OpenAIOrchestratorGateway(this.supabase);
    const orchestratorService = new OrchestratorService(orchestratorRepository, orchestratorAIGateway);
    this.orchestrator = new OrchestratorController(orchestratorService);

    const workspaceRepository = overrides.workspaceRepository ?? new SupabaseWorkspaceRepository(this.supabase);
    const workspaceServiceFactory =
      overrides.workspaceServiceFactory ?? ((repository) => new WorkspaceService(repository));
    const workspaceService = workspaceServiceFactory(workspaceRepository);
    this.workspace = new WorkspaceController(workspaceService);
  }

  registerDisposer(disposer: () => Promise<void> | void): void {
    this.disposers.push(disposer);
  }

  async dispose(): Promise<void> {
    for (const disposer of this.disposers.splice(0)) {
      await disposer();
    }
  }
}

export interface CreateContainerOptions extends AppContainerOverrides {
  supabase: SupabaseClient;
}

export function createAppContainer(options: CreateContainerOptions): AppContainer {
  return new AppContainer(options.supabase, options);
}
