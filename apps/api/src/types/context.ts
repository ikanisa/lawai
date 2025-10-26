import type { RateLimitGuard } from '../rate-limit.js';
import type { SupabaseServiceClient } from './supabase.js';

export type RateLimitGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
  keyParts?: unknown[],
) => Promise<boolean> | boolean;

export interface AppContext {
  supabase: SupabaseServiceClient;
  container: AppContainer;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
  rateLimits: {
    workspace?: RateLimitGuard;
  };
}

