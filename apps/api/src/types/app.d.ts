import type { FastifyInstance } from 'fastify';
import type { AppContainerOverrides } from '../core/container.js';
import type { AppContext } from './context.js';
import type { SupabaseServiceClient } from './supabase.js';

export interface CreateAppOptions {
  supabase?: SupabaseServiceClient;
  overrides?: AppContainerOverrides;
  registerWorkspaceRoutes?: boolean;
  includeWorkspaceDomainRoutes?: boolean;
}

export interface CreateAppResult {
  app: FastifyInstance;
  context: AppContext;
}
