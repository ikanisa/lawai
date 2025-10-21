import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OPENAI_API_KEY: z.string().min(1, { message: 'OPENAI_API_KEY is required' }),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.string().optional(),
  OPENAI_REQUEST_TAGS: z.string().optional(),
  OPENAI_REQUEST_TAGS_OPS: z.string().optional(),
  OPS_CHECK_DRY_RUN: z.enum(['0', '1']).optional(),
  VECTOR_STORE_DRY_RUN: z.enum(['0', '1']).optional(),
  API_BASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  SUPABASE_MANAGEMENT_API_URL: z.string().url().optional(),
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  OPS_ORG_ID: z.string().optional(),
  EVAL_ORG_ID: z.string().optional(),
  EVAL_USER_ID: z.string().optional(),
  EVAL_BENCHMARK: z.string().optional(),
  TRANSPARENCY_ORG_ID: z.string().optional(),
  TRANSPARENCY_USER_ID: z.string().optional(),
  SLO_ORG_ID: z.string().optional(),
  SLO_USER_ID: z.string().optional(),
  DISPATCH_ORG_ID: z.string().optional(),
  DISPATCH_USER_ID: z.string().optional(),
  LEARNING_ORG_ID: z.string().optional(),
  PERF_ORG_ID: z.string().optional(),
  PERF_USER_ID: z.string().optional(),
  PERF_WINDOW: z.string().optional(),
  RED_TEAM_ORG_ID: z.string().optional(),
  RED_TEAM_USER_ID: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),
});

export const serverEnv = envSchema.parse(process.env);

export type OpsServerEnv = typeof serverEnv;
