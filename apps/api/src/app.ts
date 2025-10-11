// @ts-nocheck
import Fastify from 'fastify';
import { registerWorkspaceRoutes } from './domain/workspace/routes';
import type { AppContext } from './types/context';
import { env } from './config.js';
import { supabase as serviceClient } from './supabase-client.js';

export async function createApp() {
  const app = Fastify({
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

  const supabase = serviceClient;

  const context: AppContext = {
    supabase,
    config: {
      openai: {
        apiKey: env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    },
  };

  await registerWorkspaceRoutes(app, context);

  return { app, context };
}
