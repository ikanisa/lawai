import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  OPENAI_API_KEY: z
    .string({ required_error: 'OPENAI_API_KEY is required' })
    .min(1, { message: 'OPENAI_API_KEY is required' }),
  AGENT_MODEL: z.string().default('gpt-5-pro'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  SUMMARISER_MODEL: z.string().optional(),
  MAX_SUMMARY_CHARS: z.coerce.number().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z
    .string({ required_error: 'OPENAI_VECTOR_STORE_AUTHORITIES_ID is required' })
    .min(1, { message: 'OPENAI_VECTOR_STORE_AUTHORITIES_ID is required' }),
  OPENAI_CHATKIT_PROJECT: z.string().optional(),
  OPENAI_CHATKIT_SECRET: z.string().optional(),
  OPENAI_CHATKIT_BASE_URL: z.string().url().optional(),
  OPENAI_CHATKIT_MODEL: z.string().optional(),
  SUPABASE_URL: z
    .string({ required_error: 'SUPABASE_URL is required' })
    .url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required' })
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
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

const PRODUCTION_CRITICAL_KEYS = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_VECTOR_STORE_AUTHORITIES_ID',
] as const;

type ProductionCriticalKey = (typeof PRODUCTION_CRITICAL_KEYS)[number];

const PLACEHOLDER_PATTERNS: Record<ProductionCriticalKey, RegExp[]> = {
  OPENAI_API_KEY: [/(?:changeme|placeholder)/i, /test-openai-key/i],
  SUPABASE_URL: [/example\.supabase\.co/i, /localhost/i, /127\.0\.0\.1/],
  SUPABASE_SERVICE_ROLE_KEY: [/placeholder/i, /service-role-test/i],
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: [/^vs_?test$/i, /placeholder/i, /changeme/i],
};

function assertProductionEnv(e: Env) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = PRODUCTION_CRITICAL_KEYS.filter((key) => !(e as Record<string, unknown>)[key]);

  if (missing.length) {
    throw new Error(`configuration_invalid missing=[${missing.join(', ')}]`);
  }

  for (const key of PRODUCTION_CRITICAL_KEYS) {
    const value = (e as Record<string, unknown>)[key];
    if (typeof value !== 'string') {
      continue;
    }

    const patterns = PLACEHOLDER_PATTERNS[key];
    for (const pattern of patterns) {
      if (pattern.test(value)) {
        throw new Error(`configuration_invalid placeholders=[${key}]`);
      }
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
