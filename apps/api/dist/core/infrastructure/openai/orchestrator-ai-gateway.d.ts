import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrchestratorCommandEnvelope } from '@avocat-ai/shared';
import type { OrchestratorAIGateway } from '../../repositories/orchestrator-repository.js';
import type { OrchestratorLogger } from '../../../orchestrator.js';
export declare class OpenAIOrchestratorGateway implements OrchestratorAIGateway {
    private readonly client;
    constructor(client: SupabaseClient);
    runSafetyAssessment(envelope: OrchestratorCommandEnvelope, logger?: OrchestratorLogger): Promise<import("@avocat-ai/shared").SafetyAssessmentResult>;
}
//# sourceMappingURL=orchestrator-ai-gateway.d.ts.map