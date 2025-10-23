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
  OPENAI_API_KEY: z.string().default(''),
  AGENT_MODEL: z.string().default('gpt-5-pro'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  SUMMARISER_MODEL: z.string().optional(),
  MAX_SUMMARY_CHARS: z.coerce.number().optional(),
  OPENAI_VECTOR_STORE_AUTHORITIES_ID: z
    .union([z.string().min(1), z.literal('')])
    .default(''),
  OPENAI_CHATKIT_PROJECT: z.string().optional(),
  OPENAI_CHATKIT_SECRET: z.string().optional(),
  OPENAI_CHATKIT_BASE_URL: z.string().url().optional(),
  OPENAI_CHATKIT_MODEL: z.string().optional(),
  SUPABASE_URL: z.union([z.string().url(), z.literal('')]).default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
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

function assertProductionEnv(e: Env) {
  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = [];
    const placeholders: string[] = [];

    if (!e.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
    if (!e.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!e.OPENAI_VECTOR_STORE_AUTHORITIES_ID) missing.push('OPENAI_VECTOR_STORE_AUTHORITIES_ID');
    if (!e.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!e.OPENAI_CHATKIT_PROJECT) missing.push('OPENAI_CHATKIT_PROJECT');
    if (!e.OPENAI_CHATKIT_SECRET) missing.push('OPENAI_CHATKIT_SECRET');

    // Basic placeholder detection
    const vectorStorePlaceholders = [/^vs(_|-)?(test|example|placeholder)$/i];
    const supabaseServiceRolePlaceholders = [
      /placeholder/i,
      /service[-_]?role[-_]?key/i,
      /service[-_]?role[-_]?test/i,
    ];

    if (e.SUPABASE_URL && e.SUPABASE_URL.includes('example')) placeholders.push('SUPABASE_URL');
    if (e.OPENAI_API_KEY && /CHANGEME|placeholder|test-openai-key/i.test(e.OPENAI_API_KEY)) placeholders.push('OPENAI_API_KEY');
    if (
      e.OPENAI_VECTOR_STORE_AUTHORITIES_ID &&
      vectorStorePlaceholders.some((pattern) => pattern.test(e.OPENAI_VECTOR_STORE_AUTHORITIES_ID))
    ) {
      placeholders.push('OPENAI_VECTOR_STORE_AUTHORITIES_ID');
    }
    if (
      e.SUPABASE_SERVICE_ROLE_KEY &&
      supabaseServiceRolePlaceholders.some((pattern) => pattern.test(e.SUPABASE_SERVICE_ROLE_KEY))
    ) {
      placeholders.push('SUPABASE_SERVICE_ROLE_KEY');
    }

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
