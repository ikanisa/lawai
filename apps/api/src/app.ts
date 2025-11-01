import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { observabilityPlugin } from './plugins/observability.js';
import { workspacePlugin } from './plugins/workspace.js';
import { compliancePlugin } from './plugins/compliance.js';
import { agentRunsPlugin } from './plugins/agent-runs.js';
import { createAppContainer } from './container.js';
import { createRateLimiterFactory, createRateLimitGuard } from './rate-limit.js';
import { registerAgentsRoutes } from './routes/agents/index.js';
import { registerCitationsRoutes } from './routes/citations/index.js';
import { registerCorpusRoutes } from './routes/corpus/index.js';
import { registerDeadlineRoutes } from './routes/deadline/index.js';
import { registerHitlRoutes } from './routes/hitl/index.js';
import { registerMattersRoutes } from './routes/matters/index.js';
import { registerRealtimeRoutes } from './routes/realtime/index.js';
import { registerResearchRoutes } from './routes/research/index.js';
import { registerUploadRoutes } from './routes/upload/index.js';
import { registerVectorStoreRoutes } from './routes/vector-stores/index.js';
import { registerVoiceRoutes } from './routes/voice/index.js';
import { registerWebSearchRoutes } from './routes/web-search/index.js';
import type { AppContext } from './types/context.js';
import type { AppAssembly, AppFastifyInstance } from './types/fastify.js';
import { env, ensureEnvironment, rateLimitConfig } from './config.js';
import { supabase as serviceClient } from './supabase-client.js';
import type { CreateAppOptions } from './types/app.js';
import { registerWorkspaceRoutes } from './domain/workspace/routes.js';

export async function createApp(options: CreateAppOptions = {}): Promise<AppAssembly> {
  const environment = ensureEnvironment();
  const app: AppFastifyInstance = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'request.headers.authorization',
        'request.headers.cookie',
        'req.body',
        'request.body',
        'body',
        'req.body.token',
        'body.token',
        'env.OPENAI_API_KEY',
        'env.SUPABASE_SERVICE_ROLE_KEY',
        'env.ALERTS_SLACK_WEBHOOK_URL',
        'env.ALERTS_EMAIL_WEBHOOK_URL',
      ],
    },
    trustProxy: true,
  });

  const {
    supabase: supabaseOverride,
    overrides,
    registerWorkspaceRoutes: _registerWorkspaceRoutes = true,
    includeWorkspaceDomainRoutes: _includeWorkspaceDomainRoutes = true,
  } = options;

  const supabase = supabaseOverride ?? serviceClient;
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", 'https://api.openai.com'],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(fastifyRateLimit, {
    global: true,
    max: environment.GLOBAL_RATE_LIMIT_MAX,
    timeWindow: environment.GLOBAL_RATE_LIMIT_WINDOW,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    allowList: [],
    hook: 'onRequest',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      code: 'rate_limited',
    }),
  });
  await app.register(observabilityPlugin);
  const container = createAppContainer({
    supabase,
    ...(overrides ?? {}),
  });

  const rateLimiterFactory = createRateLimiterFactory({
    driver: rateLimitConfig.driver,
    namespace: rateLimitConfig.namespace,
    functionName: rateLimitConfig.functionName,
    supabase:
      rateLimitConfig.driver === 'supabase'
        ? { client: supabase, functionName: rateLimitConfig.functionName }
        : undefined,
    logger: app.log,
  });

  const context: AppContext = {
    supabase,
    container,
    config: {
      openai: {
        apiKey: env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    },
    rateLimiterFactory,
    rateLimits: {},
    limiters: {},
  };

  await app.register(agentRunsPlugin, { context, rateLimiterFactory });
  await app.register(compliancePlugin, { context, rateLimiterFactory });

  if (_registerWorkspaceRoutes) {
    await app.register(workspacePlugin, { context, rateLimiterFactory });
  }

  if (_includeWorkspaceDomainRoutes) {
    const workspaceLimiter =
      context.limiters.workspace ?? rateLimiterFactory.create('workspace', rateLimitConfig.buckets.workspace);
    if (!context.limiters.workspace) {
      context.limiters.workspace = workspaceLimiter;
    }
    const workspaceGuard =
      context.rateLimits.workspace ??
      createRateLimitGuard(workspaceLimiter, {
        name: 'workspace',
        errorResponse: () => ({ error: 'rate_limited', scope: 'workspace' }),
      });
    context.rateLimits.workspace = workspaceGuard;

    await registerWorkspaceRoutes(app, context);
  }

  await app.register(async (instance: FastifyInstance) => {
    await registerAgentsRoutes(instance, context);
    await registerResearchRoutes(instance, context);
    await registerCitationsRoutes(instance, context);
    await registerCorpusRoutes(instance, context);
    await registerMattersRoutes(instance, context);
    await registerHitlRoutes(instance, context);
    await registerDeadlineRoutes(instance, context);
    await registerUploadRoutes(instance, context);
    await registerVectorStoreRoutes(instance, context);
    await registerVoiceRoutes(instance, context);
    await registerRealtimeRoutes(instance, context);
    await registerWebSearchRoutes(instance, context);
  }, { prefix: '/api' });

  return { app, context };
}
