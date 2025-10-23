import { z } from 'zod';
import { resolveDomainAllowlistOverride } from './allowlist-override.js';

import {
  loadServerEnv,
  sharedOpenAiSchema,
  sharedOptionalIntegrationsSchema,
  sharedSupabaseSchema,
} from '@avocat-ai/shared';

const envSchema = sharedSupabaseSchema
  .extend({
    SUPABASE_URL: sharedSupabaseSchema.shape.SUPABASE_URL.default(
      'https://example.supabase.co',
    ),
    SUPABASE_SERVICE_ROLE_KEY: sharedSupabaseSchema.shape.SUPABASE_SERVICE_ROLE_KEY.default(''),
  })
  .merge(
    sharedOpenAiSchema.extend({
      OPENAI_API_KEY: sharedOpenAiSchema.shape.OPENAI_API_KEY.default(''),
      OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.string().min(1).default('vs_test'),
    }),
  )
  .merge(sharedOptionalIntegrationsSchema)
  .extend({
    PORT: z.coerce.number().default(3000),
    AGENT_MODEL: z.string().default('gpt-5-pro'),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
    EMBEDDING_DIMENSION: z.coerce
      .number()
      .int()
      .positive()
      .max(3072)
      .optional(),
    SUMMARISER_MODEL: z.string().optional(),
    MAX_SUMMARY_CHARS: z.coerce.number().optional(),
    AGENT_STUB_MODE: z
      .enum(['auto', 'always', 'never'])
      .default('auto'),
    // Governance / policy tagging
    POLICY_VERSION: z.string().optional(),
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
    if (!e.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!e.OPENAI_CHATKIT_PROJECT) missing.push('OPENAI_CHATKIT_PROJECT');
    if (!e.OPENAI_CHATKIT_SECRET) missing.push('OPENAI_CHATKIT_SECRET');

    // Basic placeholder detection
    if (
      e.SUPABASE_URL &&
      SUPABASE_URL_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(e.SUPABASE_URL))
    )
      placeholders.push('SUPABASE_URL');
    if (
      e.OPENAI_API_KEY &&
      OPENAI_KEY_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(e.OPENAI_API_KEY))
    )
      placeholders.push('OPENAI_API_KEY');
    if (
      e.SUPABASE_SERVICE_ROLE_KEY &&
      SUPABASE_SERVICE_ROLE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(e.SUPABASE_SERVICE_ROLE_KEY))
    )
      placeholders.push('SUPABASE_SERVICE_ROLE_KEY');
    if (e.OPENAI_CHATKIT_PROJECT && e.OPENAI_CHATKIT_PROJECT.trim().toLowerCase() === 'example') {
      placeholders.push('OPENAI_CHATKIT_PROJECT');
    }
    if (e.OPENAI_CHATKIT_SECRET && /placeholder|example|changeme/i.test(e.OPENAI_CHATKIT_SECRET)) {
      placeholders.push('OPENAI_CHATKIT_SECRET');
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
