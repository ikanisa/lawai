import fp from 'fastify-plugin';
import { z } from 'zod';
import { rateLimitConfig } from '../config.js';
import { createRateLimitGuard, createRateLimitPreHandler, enforceRateLimit, SupabaseRateLimiter, } from '../rate-limit.js';
import { authorizeRequestWithGuards } from '../http/authorization.js';
import { runLegalAgent } from '../agent-wrapper.js';
import { IRACPayloadSchema } from '../schemas/irac.js';
import { TelemetrySampler } from '../services/orchestration/telemetry-sampler.js';
import { OpenAIBudgetManager } from '../services/orchestration/openai-budget-manager.js';
import { TimeoutGuard } from '../services/orchestration/timeout-guard.js';
import { incrementCounter } from '../observability/metrics.js';
const requestSchema = z.object({
    question: z.string().min(1),
    context: z.string().optional(),
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    confidentialMode: z.coerce.boolean().optional(),
    userLocation: z.string().optional(),
});
export const agentRunsPlugin = fp(async (app, options) => {
    const { context, rateLimiterFactory } = options;
    const runsLimiter = rateLimiterFactory.create('runs', rateLimitConfig.buckets.runs);
    const runsGuard = createRateLimitGuard(runsLimiter, {
        name: 'runs',
        errorResponse: () => ({ error: 'rate_limited', scope: 'runs' }),
    });
    context.limiters.runs = runsLimiter;
    context.rateLimits.runs = runsGuard;
    const sensitiveLimiter = new SupabaseRateLimiter({
        supabase: context.supabase,
        limit: 30,
        windowSeconds: 60,
        prefix: 'sensitive',
    });
    const runExecutionRateLimit = createRateLimitPreHandler({
        limiter: sensitiveLimiter,
        keyGenerator: (request) => {
            const body = request.body;
            const bodyOrg = typeof body?.orgId === 'string' ? body.orgId : undefined;
            const bodyUser = typeof body?.userId === 'string' ? body.userId : undefined;
            const orgHeader = typeof request.headers['x-org-id'] === 'string' ? request.headers['x-org-id'] : undefined;
            const userHeader = typeof request.headers['x-user-id'] === 'string' ? request.headers['x-user-id'] : undefined;
            const orgId = bodyOrg ?? orgHeader ?? null;
            const userId = bodyUser ?? userHeader ?? null;
            if (orgId && userId) {
                return `${orgId}:${userId}:runs`;
            }
            return request.ip ? `${request.ip}:runs` : null;
        },
        errorResponse: () => ({ error: 'rate_limited', scope: 'runs' }),
    });
    app.post('/runs', { preHandler: [runExecutionRateLimit] }, async (request, reply) => {
        const parsed = requestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
        }
        const { question, context: questionContext, orgId, userId, confidentialMode, userLocation } = parsed.data;
        const allowed = await enforceRateLimit(runsLimiter, request, reply, `runs:${orgId}:${userId}`, () => ({ error: 'rate_limited', scope: 'runs' }));
        if (!allowed) {
            return;
        }
        if (await runsGuard(request, reply, [orgId, userId])) {
            return;
        }
        const telemetrySampler = new TelemetrySampler({ sampleRate: 1 });
        const budgetManager = new OpenAIBudgetManager({ totalTokens: 80_000 });
        const timeoutGuard = new TimeoutGuard({ timeoutMs: 60_000 });
        try {
            const estimatedTokens = budgetManager.estimatePromptTokens(`${question}\n${questionContext ?? ''}`);
            budgetManager.consume(estimatedTokens);
        }
        catch (error) {
            app.log.warn({ err: error, orgId, userId }, 'agent_run_budget_rejected');
            return reply.code(429).send({ error: 'openai_budget_exceeded' });
        }
        try {
            const access = await authorizeRequestWithGuards('runs:execute', orgId, userId, request);
            const effectiveConfidential = access.policies.confidentialMode || Boolean(confidentialMode);
            const result = await timeoutGuard.run(() => runLegalAgent({
                question,
                context: questionContext,
                orgId,
                userId,
                confidentialMode: effectiveConfidential,
                userLocationOverride: userLocation?.trim() ?? null,
            }, access));
            const safePayload = IRACPayloadSchema.safeParse(result.payload);
            const responsePayload = safePayload.success
                ? safePayload.data
                : (result.payload ?? {});
            if (telemetrySampler.shouldSample()) {
                incrementCounter('api.agent_runs.executed', { status: 'success' });
            }
            return {
                runId: result.runId,
                data: responsePayload,
                toolLogs: [],
                plan: [],
                notices: result.notices ?? [],
                reused: Boolean(result.reused),
                verification: result.verification ?? null,
                trustPanel: result.trustPanel ?? null,
            };
        }
        catch (error) {
            if (telemetrySampler.shouldSample()) {
                incrementCounter('api.agent_runs.executed', { status: 'error' });
            }
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            if (error instanceof Error && error.message === 'timeout_guard') {
                return reply.code(504).send({ error: 'timeout_guard' });
            }
            app.log.error({ err: error, orgId, userId }, 'agent_execution_failed');
            return reply.code(502).send({
                error: 'agent_failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
});
