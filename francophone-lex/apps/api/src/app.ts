import Fastify from 'fastify';
import { createApiSupabaseClient } from '@avocat-ai/shared/supabase';
import { registerWorkspaceRoutes } from './domain/workspace/routes.js';
import type { AppContext } from './types/context.js';

export async function createApp() {
  const app = Fastify({ logger: true });

  const supabase = createApiSupabaseClient({
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });

  const context: AppContext = {
    supabase,
    config: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    },
  };

  await registerWorkspaceRoutes(app, context);

  return { app, context };
}
