import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrchestratorCommandEnvelope } from '@avocat-ai/shared';
import { runSafetyAssessment } from '../../../orchestrator.js';
import type { OrchestratorAIGateway } from '../../repositories/orchestrator-repository.js';
import type { OrchestratorLogger } from '../../../orchestrator.js';

export class OpenAIOrchestratorGateway implements OrchestratorAIGateway {
  constructor(private readonly client: SupabaseClient) {}

  runSafetyAssessment(envelope: OrchestratorCommandEnvelope, logger?: OrchestratorLogger) {
    return runSafetyAssessment(this.client, envelope, logger);
  }
}
