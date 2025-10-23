import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

export const nodeEnvironmentSchema = z
  .enum(['development', 'test', 'production'])
  .default(
    ((process.env.NODE_ENV as 'development' | 'test' | 'production' | undefined) ??
      'development') satisfies 'development' | 'test' | 'production',
  );

export const sharedSupabaseSchema = z.object({
  SUPABASE_URL: z
    .string()
    .url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_MANAGEMENT_API_URL: z.string().url().optional(),
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),
});

export const sharedOpenAiSchema = z.object({
  OPENAI_API_KEY: z.string(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.string().optional(),
  OPENAI_REQUEST_TAGS: z.string().optional(),
  OPENAI_REQUEST_TAGS_API: z.string().optional(),
  OPENAI_REQUEST_TAGS_OPS: z.string().optional(),
  OPENAI_REQUEST_TAGS_EDGE: z.string().optional(),
});

export const sharedOptionalIntegrationsSchema = z.object({
  JURIS_ALLOWLIST_JSON: z.string().optional(),
  OPENAI_CHATKIT_PROJECT: z.string().optional(),
  OPENAI_CHATKIT_SECRET: z.string().optional(),
  OPENAI_CHATKIT_BASE_URL: z.string().url().optional(),
  OPENAI_CHATKIT_MODEL: z.string().optional(),
  WA_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_TEMPLATE_OTP_NAME: z.string().optional(),
  WA_TEMPLATE_LOCALE: z.string().optional(),
  WA_PROVIDER: z.enum(['twilio', 'meta']).optional(),
  C2PA_SIGNING_PRIVATE_KEY: z.string().optional(),
  C2PA_SIGNING_KEY_ID: z.string().optional(),
});

export interface LoadServerEnvOptions {
  dotenv?: boolean;
  source?: Record<string, unknown>;
}

export function loadServerEnv<T extends z.ZodTypeAny>(
  schema: T,
  { dotenv = process.env.NODE_ENV !== 'production', source = process.env }: LoadServerEnvOptions = {},
): z.infer<T> {
  if (dotenv) {
    loadEnv();
  }

  return schema.parse(source);
}

export type SharedSupabaseEnv = z.infer<typeof sharedSupabaseSchema>;
export type SharedOpenAiEnv = z.infer<typeof sharedOpenAiSchema>;
export type SharedOptionalIntegrationsEnv = z.infer<
  typeof sharedOptionalIntegrationsSchema
>;
