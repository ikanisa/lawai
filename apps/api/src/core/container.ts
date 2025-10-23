import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrchestratorRepository } from './infrastructure/supabase/orchestrator-repository.js';
import { OpenAIOrchestratorGateway } from './infrastructure/openai/orchestrator-ai-gateway.js';
import { OrchestratorService } from './services/orchestrator-service.js';
import { OrchestratorController } from './controllers/orchestrator-controller.js';
import type { OrchestratorAIGateway, OrchestratorRepository } from './repositories/orchestrator-repository.js';

export interface AppContainerOverrides {
  orchestratorRepository?: OrchestratorRepository;
  orchestratorAIGateway?: OrchestratorAIGateway;
}

export class AppContainer {
  public readonly orchestrator: OrchestratorController;

  constructor(private readonly supabase: SupabaseClient, overrides: AppContainerOverrides = {}) {
    const orchestratorRepository = overrides.orchestratorRepository ?? new SupabaseOrchestratorRepository(this.supabase);
    const orchestratorAIGateway = overrides.orchestratorAIGateway ?? new OpenAIOrchestratorGateway(this.supabase);
    const orchestratorService = new OrchestratorService(orchestratorRepository, orchestratorAIGateway);
    this.orchestrator = new OrchestratorController(orchestratorService);
  }
}

export interface CreateContainerOptions extends AppContainerOverrides {
  supabase: SupabaseClient;
}

export function createAppContainer(options: CreateContainerOptions): AppContainer {
  return new AppContainer(options.supabase, options);
}
