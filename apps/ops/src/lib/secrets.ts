const WEAK_VALUES = new Set(['', 'test', 'service', 'changeme']);

function normalize(value: string | undefined): string {
  return (value ?? '').trim();
}

export type SecretAuditIssue = {
  key: string;
  reason: string;
};

export function auditSecrets(env: Record<string, string>): SecretAuditIssue[] {
  const issues: SecretAuditIssue[] = [];

  const openaiKey = normalize(env.OPENAI_API_KEY);
  if (openaiKey.length < 32 || WEAK_VALUES.has(openaiKey.toLowerCase())) {
    issues.push({ key: 'OPENAI_API_KEY', reason: 'missing or using a default/test value' });
  }

  const serviceRole = normalize(env.SUPABASE_SERVICE_ROLE_KEY);
  if (serviceRole.length < 32 || WEAK_VALUES.has(serviceRole.toLowerCase())) {
    issues.push({ key: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'missing or too short for production use' });
  }

  const anonKey = normalize(env.SUPABASE_ANON_KEY);
  if (anonKey && (anonKey.length < 32 || WEAK_VALUES.has(anonKey.toLowerCase()))) {
    issues.push({ key: 'SUPABASE_ANON_KEY', reason: 'appears to be a placeholder or short-lived key' });
  }

  const supabaseUrl = normalize(env.SUPABASE_URL);
  if (!supabaseUrl || supabaseUrl.includes('example.supabase.co')) {
    issues.push({ key: 'SUPABASE_URL', reason: 'not pointing to a concrete Supabase project' });
  }

  return issues;
}
