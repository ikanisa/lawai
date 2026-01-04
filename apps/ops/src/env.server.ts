import { z } from 'zod';
import {
  loadServerEnv,
  nodeEnvironmentSchema,
  sharedOpenAiSchema,
  sharedSupabaseSchema,
} from '@avocat-ai/shared';

const envSchema = sharedSupabaseSchema
  .extend({
    NODE_ENV: nodeEnvironmentSchema,
    SUPABASE_SERVICE_ROLE_KEY: sharedSupabaseSchema.shape.SUPABASE_SERVICE_ROLE_KEY.min(1, {
      message: 'SUPABASE_SERVICE_ROLE_KEY is required',
    }),
  })
  .merge(
    sharedOpenAiSchema.extend({
      OPENAI_API_KEY: sharedOpenAiSchema.shape.OPENAI_API_KEY.min(1, {
        message: 'OPENAI_API_KEY is required',
      }),
    }),
  )
  .extend({
    OPENAI_BASE_URL: sharedOpenAiSchema.shape.OPENAI_BASE_URL,
    OPENAI_VECTOR_STORE_AUTHORITIES_ID: sharedOpenAiSchema.shape.OPENAI_VECTOR_STORE_AUTHORITIES_ID,
    OPENAI_REQUEST_TAGS: sharedOpenAiSchema.shape.OPENAI_REQUEST_TAGS,
    OPENAI_REQUEST_TAGS_OPS: sharedOpenAiSchema.shape.OPENAI_REQUEST_TAGS_OPS,
    OPS_CHECK_DRY_RUN: z.enum(['0', '1']).optional(),
    VECTOR_STORE_DRY_RUN: z.enum(['0', '1']).optional(),
    API_BASE_URL: z.string().url().optional(),
    SUPABASE_MANAGEMENT_API_URL: sharedSupabaseSchema.shape.SUPABASE_MANAGEMENT_API_URL,
    SUPABASE_ACCESS_TOKEN: sharedSupabaseSchema.shape.SUPABASE_ACCESS_TOKEN,
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
    SUPABASE_PROJECT_REF: sharedSupabaseSchema.shape.SUPABASE_PROJECT_REF,
    SUPABASE_DB_URL: sharedSupabaseSchema.shape.SUPABASE_DB_URL,
    EMBEDDING_DIMENSION: z.coerce.number().int().positive().max(3072).optional(),
    OPENAI_EVAL_DATASET_MAP: z.string().optional(),
    OPENAI_EVAL_AGENT_ID: z.string().optional(),
  });

export const serverEnv = loadServerEnv(envSchema);

export type OpsServerEnv = typeof serverEnv;
