import 'server-only';
import { z } from 'zod';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_ENV: z.string().optional(),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  SUPABASE_URL: z
    .string()
    .url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_ANON_KEY is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  ADMIN_PANEL_ACTOR: z.string().optional(),
  ADMIN_PANEL_ORG: z.string().optional(),
  FEAT_ADMIN_PANEL: z.string().optional(),
});

export const serverEnv = serverSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_PANEL_ACTOR: process.env.ADMIN_PANEL_ACTOR,
  ADMIN_PANEL_ORG: process.env.ADMIN_PANEL_ORG,
  FEAT_ADMIN_PANEL: process.env.FEAT_ADMIN_PANEL,
});
