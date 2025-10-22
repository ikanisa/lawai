import Fastify from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerWorkspaceRoutes } from './domain/workspace/routes.js';
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
import type { AppContext } from './types/context.js';
import { env } from './config.js';
import { supabase as serviceClient } from './supabase-client.js';
import { createAppContainer, type AppContainerOverrides } from './core/container.js';
import { observabilityPlugin } from './core/observability/observability-plugin.js';

export interface CreateAppOptions {
  supabase?: SupabaseClient;
  overrides?: AppContainerOverrides;
  registerWorkspaceRoutes?: boolean;
}

export async function createApp(options: CreateAppOptions = {}) {
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

  const supabase = options.supabase ?? serviceClient;
  const container = createAppContainer({
    supabase,
    ...(options.overrides ?? {}),
  });

  const shouldRegisterWorkspaceRoutes = options.registerWorkspaceRoutes ?? true;

  const context: AppContext = {
    supabase,
    config: {
      openai: {
        apiKey: env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    },
    container,
  };

  await app.register(async (instance) => {
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

  if (!(app as any).workspaceRoutesRegistered) {
    if (shouldRegisterWorkspaceRoutes) {
      await registerWorkspaceRoutes(app, context);
      (app as any).workspaceRoutesRegistered = true;
    }
  }

  return { app, context };
}
