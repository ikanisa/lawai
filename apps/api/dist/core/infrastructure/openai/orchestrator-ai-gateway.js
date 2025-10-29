import { runSafetyAssessment } from '../../../orchestrator.js';
export class OpenAIOrchestratorGateway {
    client;
    constructor(client) {
        this.client = client;
    }
    runSafetyAssessment(envelope, logger) {
        return runSafetyAssessment(this.client, envelope, logger);
    }
}
