import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  OPENAI_API_KEY: z.string().min(1).default('test-openai-key'),
  AGENT_MODEL: z.string().default('gpt-5-pro'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  SUMMARISER_MODEL: z.string().optional(),
  MAX_SUMMARY_CHARS: z.coerce.number().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.string().min(1).default('vs_test'),
  SUPABASE_URL: z.string().url().default('https://example.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('service-role-test'),
  JURIS_ALLOWLIST_JSON: z.string().optional(),
  AGENT_STUB_MODE: z
    .enum(['auto', 'always', 'never'])
    .default('auto'),
});

type Env = z.infer<typeof envSchema>;

const parsed = envSchema.parse({
  ...process.env,
});

export const env: Env = parsed;

export function loadAllowlistOverride(): string[] | null {
  if (!parsed.JURIS_ALLOWLIST_JSON) {
    return null;
  }

  try {
    const value = JSON.parse(parsed.JURIS_ALLOWLIST_JSON);
    if (!Array.isArray(value)) {
      return null;
    }
    return value as string[];
  } catch (error) {
    return null;
  }
}
