import 'server-only';
import { z } from 'zod';

import { loadServerEnv, nodeEnvironmentSchema, sharedSupabaseSchema } from '@avocat-ai/shared';

const serverSchema = sharedSupabaseSchema.extend({
  NODE_ENV: nodeEnvironmentSchema,
  APP_ENV: z.string().optional(),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  SUPABASE_SERVICE_ROLE_KEY: sharedSupabaseSchema.shape.SUPABASE_SERVICE_ROLE_KEY.min(1, {
    message: 'SUPABASE_SERVICE_ROLE_KEY is required',
  }),
  ADMIN_PANEL_ACTOR: z.string().optional(),
  ADMIN_PANEL_ORG: z.string().optional(),
  FEAT_ADMIN_PANEL: z.string().optional(),
});

export const serverEnv = loadServerEnv(serverSchema, { dotenv: false });
