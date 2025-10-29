import { IRACPayloadSchema } from './schemas/irac.js';
import { ToolInvocationLogsSchema } from './schemas/tools.js';
export async function runLegalAgent(input, access) {
    // Use dynamic import via Function to avoid pulling agent.ts into the typecheck program
    const importer = new Function('p', 'return import(p)');
    const mod = (await importer('./agent.js'));
    const rawRun = mod.runLegalAgent;
    const result = (await rawRun(input, access));
    const validated = IRACPayloadSchema.safeParse(result.payload);
    if (validated.success) {
        // Assign the parsed IRAC payload back for stronger shape at boundaries
        result.payload = validated.data;
    }
    // Normalise tool logs shape defensively
    const toolsParsed = ToolInvocationLogsSchema.safeParse(result.toolLogs ?? []);
    if (toolsParsed.success) {
        result.toolLogs = toolsParsed.data;
    }
    else {
        result.toolLogs = [];
    }
    return result;
}
export async function getHybridRetrievalContext(orgId, query, jurisdiction) {
    const importer = new Function('p', 'return import(p)');
    const mod = (await importer('./agent.js'));
    return mod.getHybridRetrievalContext(orgId, query, jurisdiction);
}
