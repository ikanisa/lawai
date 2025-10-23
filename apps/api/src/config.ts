import { z } from 'zod';
import { resolveDomainAllowlistOverride } from './allowlist-override.js';

import {
  loadServerEnv,
  sharedOpenAiSchema,
  sharedOptionalIntegrationsSchema,
  sharedSupabaseSchema,
} from '@avocat-ai/shared';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required'),
  AGENT_MODEL: z.string().default('gpt-5-pro'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  SUMMARISER_MODEL: z.string().optional(),
  MAX_SUMMARY_CHARS: z.coerce.number().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z
    .string()
    .trim()
    .min(1, 'OPENAI_VECTOR_STORE_AUTHORITIES_ID is required'),
  OPENAI_CHATKIT_PROJECT: z.string().optional(),
  OPENAI_CHATKIT_SECRET: z.string().optional(),
  OPENAI_CHATKIT_BASE_URL: z.string().url().optional(),
  OPENAI_CHATKIT_MODEL: z.string().optional(),
  SUPABASE_URL: z
    .string()
    .trim()
    .url('SUPABASE_URL must be a valid URL')
    .min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .trim()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
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
  // Rate limiter configuration
  RATE_LIMITER_DRIVER: z.enum(['memory', 'supabase']).default('memory'),
  RATE_LIMITER_NAMESPACE: z.string().default('api'),
  RATE_LIMITER_SUPABASE_FUNCTION: z.string().default('increment_rate_limit'),
  RATE_LIMIT_RUNS_LIMIT: z.coerce.number().default(30),
  RATE_LIMIT_RUNS_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_COMPLIANCE_LIMIT: z.coerce.number().default(120),
  RATE_LIMIT_COMPLIANCE_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_WORKSPACE_LIMIT: z.coerce.number().default(60),
  RATE_LIMIT_WORKSPACE_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_TELEMETRY_LIMIT: z.coerce.number().default(60),
  RATE_LIMIT_TELEMETRY_WINDOW_MS: z.coerce.number().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

const parsed = loadServerEnv(envSchema);

const SUPABASE_URL_PLACEHOLDER_PATTERNS = [
  /example\.supabase\.co/i,
  /project\.supabase\.co/i,
  /localhost/i,
];

const OPENAI_KEY_PLACEHOLDER_PATTERNS = [
  /CHANGEME/i,
  /placeholder/i,
  /test-openai-key/i,
  /^sk-(?:test|demo|example|placeholder|dummy|sample)/i,
];

const SUPABASE_SERVICE_ROLE_PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /service-role-test/i,
];

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
  if (process.env.NODE_ENV === 'production') {
    const placeholders: string[] = [];

    // Basic placeholder detection
    if (e.SUPABASE_URL.includes('example') || e.SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
      placeholders.push('SUPABASE_URL');
    }
    if (/CHANGEME|placeholder|test-openai-key/i.test(e.OPENAI_API_KEY)) {
      placeholders.push('OPENAI_API_KEY');
    }
    if (/placeholder|service-role-test/i.test(e.SUPABASE_SERVICE_ROLE_KEY)) {
      placeholders.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (e.OPENAI_VECTOR_STORE_AUTHORITIES_ID === 'vs_test') {
      placeholders.push('OPENAI_VECTOR_STORE_AUTHORITIES_ID');
    }

    if (placeholders.length) {
      const details = `placeholders=[${placeholders.join(', ')}]`;
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
    return resolveDomainAllowlistOverride(value);
  } catch (error) {
    return null;
  }
}

export const rateLimitConfig = {
  driver: env.RATE_LIMITER_DRIVER,
  namespace: env.RATE_LIMITER_NAMESPACE,
  functionName: env.RATE_LIMITER_SUPABASE_FUNCTION,
  buckets: {
    runs: { limit: env.RATE_LIMIT_RUNS_LIMIT, windowMs: env.RATE_LIMIT_RUNS_WINDOW_MS },
    compliance: { limit: env.RATE_LIMIT_COMPLIANCE_LIMIT, windowMs: env.RATE_LIMIT_COMPLIANCE_WINDOW_MS },
    workspace: { limit: env.RATE_LIMIT_WORKSPACE_LIMIT, windowMs: env.RATE_LIMIT_WORKSPACE_WINDOW_MS },
    telemetry: { limit: env.RATE_LIMIT_TELEMETRY_LIMIT, windowMs: env.RATE_LIMIT_TELEMETRY_WINDOW_MS },
  },
};
