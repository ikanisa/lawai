import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  OPENAI_API_KEY: z.string().default(''),
  AGENT_MODEL: z.string().default('gpt-5-pro'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  SUMMARISER_MODEL: z.string().optional(),
  MAX_SUMMARY_CHARS: z.coerce.number().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.string().min(1).default('vs_test'),
  OPENAI_CHATKIT_PROJECT: z.string().optional(),
  OPENAI_CHATKIT_SECRET: z.string().optional(),
  OPENAI_CHATKIT_BASE_URL: z.string().url().optional(),
  OPENAI_CHATKIT_MODEL: z.string().optional(),
  SUPABASE_URL: z.string().url().default('https://example.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('test-service-role-key'),
  RATE_LIMIT_PROVIDER: z.enum(['memory', 'redis', 'supabase']).default('memory'),
  RATE_LIMIT_REDIS_URL: z.string().url().optional(),
  RATE_LIMIT_SUPABASE_FUNCTION: z.string().default('enforce_rate_limit'),
  RATE_LIMIT_RUNS_LIMIT: z.coerce.number().default(60),
  RATE_LIMIT_RUNS_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_COMPLIANCE_LIMIT: z.coerce.number().default(90),
  RATE_LIMIT_COMPLIANCE_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_WORKSPACE_LIMIT: z.coerce.number().default(90),
  RATE_LIMIT_WORKSPACE_WINDOW_MS: z.coerce.number().default(60_000),
  JURIS_ALLOWLIST_JSON: z.string().optional(),
  AGENT_STUB_MODE: z
    .enum(['auto', 'always', 'never'])
    .default('auto'),
  // Optional WhatsApp OTP integration
  WA_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_TEMPLATE_OTP_NAME: z.string().optional(),
  WA_TEMPLATE_LOCALE: z.string().optional(),
  WA_PROVIDER: z.enum(['twilio', 'meta']).optional(),
  // Optional C2PA signing keys for export
  C2PA_SIGNING_PRIVATE_KEY: z.string().optional(),
  C2PA_SIGNING_KEY_ID: z.string().optional(),
  // Governance / policy tagging
  POLICY_VERSION: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.parse({
  ...process.env,
});

function assertProductionEnv(e: Env) {
  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = [];
    const placeholders: string[] = [];

    if (!e.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
    if (!e.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!e.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (e.RATE_LIMIT_PROVIDER === 'redis' && !e.RATE_LIMIT_REDIS_URL) {
      missing.push('RATE_LIMIT_REDIS_URL');
    }

    // Basic placeholder detection
    if (e.SUPABASE_URL && e.SUPABASE_URL.includes('example')) placeholders.push('SUPABASE_URL');
    if (e.OPENAI_API_KEY && /CHANGEME|placeholder|test-openai-key/i.test(e.OPENAI_API_KEY)) placeholders.push('OPENAI_API_KEY');
    if (
      e.SUPABASE_SERVICE_ROLE_KEY &&
      /placeholder|service-role-test|^test-service-role-key$/i.test(e.SUPABASE_SERVICE_ROLE_KEY)
    )
      placeholders.push('SUPABASE_SERVICE_ROLE_KEY');

    if (missing.length || placeholders.length) {
      const details = [
        missing.length ? `missing=[${missing.join(', ')}]` : null,
        placeholders.length ? `placeholders=[${placeholders.join(', ')}]` : null,
      ]
        .filter(Boolean)
        .join(' ');
      throw new Error(`configuration_invalid ${details}`);
    }
  }
}

assertProductionEnv(parsed);

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
