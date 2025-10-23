import Fastify from 'fastify';
import { registerAgentsRoutes } from './routes/agents/index.js';
import { registerCitationsRoutes } from './routes/citations/index.js';
import { registerCorpusRoutes } from './routes/corpus/index.js';
import { registerDeadlineRoutes } from './routes/deadline/index.js';
import { registerHitlRoutes } from './routes/hitl/index.js';
import { registerMattersRoutes } from './routes/matters/index.js';
import { registerRealtimeRoutes } from './routes/realtime/index.js';
import { registerResearchRoutes } from './routes/research/index.js';
import { registerUploadRoutes } from './routes/upload/index.js';
import { registerVoiceRoutes } from './routes/voice/index.js';
import type { AppContext } from './types/context';
import { env, rateLimitConfig } from './config.js';
import { supabase as serviceClient } from './supabase-client.js';
import type { CreateAppResult } from './types/app';

export async function createApp(): Promise<CreateAppResult> {
  const app = Fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
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
  });

  await app.register(observabilityPlugin);

  const { supabase: supabaseOverride, overrides, includeWorkspaceDomainRoutes = false } = options;

  const supabase = supabaseOverride ?? serviceClient;
  const container = createAppContainer({
    supabase,
    ...(overrides ?? {}),
  });

  const shouldRegisterWorkspaceRoutes = options.registerWorkspaceRoutes ?? true;

  const rateLimiterFactory = createRateLimiterFactory({
    driver: rateLimitConfig.driver,
    namespace: rateLimitConfig.namespace,
    functionName: rateLimitConfig.functionName,
    supabase: rateLimitConfig.driver === 'supabase' ? supabase : undefined,
    logger: app.log,
  });

  const context: AppContext = {
    supabase,
    config: {
      openai: {
        apiKey: env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    },
    rateLimits: {},
  };

  await app.register(async (instance: FastifyInstance) => {
    await registerAgentsRoutes(instance, context);
    await registerResearchRoutes(instance, context);
    await registerCitationsRoutes(instance, context);
    await registerCorpusRoutes(instance, context);
    await registerMattersRoutes(instance, context);
    await registerHitlRoutes(instance, context);
    await registerDeadlineRoutes(instance, context);
    await registerUploadRoutes(instance, context);
    await registerVoiceRoutes(instance, context);
    await registerRealtimeRoutes(instance, context);
  }, { prefix: '/api' });

  return { app, context };
}
