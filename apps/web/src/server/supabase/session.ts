import { cookies as nextCookies } from 'next/headers';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { serverEnv } from '../../env.server';

export interface SupabaseAdminSession {
  user: User;
  accessToken: string;
  roles: string[];
  organizations: string[];
  actorId: string | null;
}

let cachedClient: SupabaseClient | null = null;

function getSupabaseServiceClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRole } = serverEnv;
  if (!url || !serviceRole) {
    return null;
  }

  cachedClient = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

function parseCookies(request?: Request): Record<string, string> {
  if (request) {
    const raw = request.headers.get('cookie');
    if (!raw) return {};
    return raw.split(';').reduce<Record<string, string>>((acc, part) => {
      const [name, ...rest] = part.split('=');
      if (!name) return acc;
      acc[name.trim()] = rest.join('=').trim();
      return acc;
    }, {});
  }

  try {
    const store = nextCookies();
    return Object.fromEntries(store.getAll().map(({ name, value }) => [name, value]));
  } catch {
    return {};
  }
}

function decodeMaybeJson(value: string): unknown {
  const attempts = [
    () => JSON.parse(value),
    () => JSON.parse(decodeURIComponent(value)),
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      continue;
    }
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function tryExtractAccessTokenFromValue(value: string): string | null {
  if (!value) return null;
  const decoded = decodeMaybeJson(value);

  if (typeof decoded === 'string') {
    return decoded || null;
  }

  if (Array.isArray(decoded)) {
    const maybeToken = decoded[0];
    return typeof maybeToken === 'string' && maybeToken ? maybeToken : null;
  }

  if (typeof decoded === 'object' && decoded !== null) {
    const maybeAccessToken =
      (decoded as Record<string, unknown>).access_token ??
      (decoded as Record<string, unknown>).accessToken ??
      (decoded as Record<string, unknown>).token ??
      (decoded as Record<string, unknown>).currentSession?.access_token ??
      (decoded as Record<string, unknown>).currentSession?.accessToken ??
      (decoded as Record<string, unknown>).session?.access_token ??
      (decoded as Record<string, unknown>).session?.accessToken;

    if (typeof maybeAccessToken === 'string' && maybeAccessToken) {
      return maybeAccessToken;
    }
  }

  return null;
}

function extractAccessToken(request?: Request): string | null {
  const authorization = request?.headers.get('authorization') ?? request?.headers.get('Authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const cookies = parseCookies(request);
  for (const [name, value] of Object.entries(cookies)) {
    const normalized = name.toLowerCase();
    if (!normalized.includes('supabase') && !normalized.includes('sb-')) {
      continue;
    }
    if (!normalized.includes('access-token') && !normalized.endsWith('auth-token')) {
      continue;
    }

    const token = tryExtractAccessTokenFromValue(value);
    if (token) {
      return token;
    }
  }

  // Fall back to scanning all cookies for structured values that may hold access tokens
  for (const value of Object.values(cookies)) {
    const token = tryExtractAccessTokenFromValue(value);
    if (token) {
      return token;
    }
  }

  return null;
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function collectStringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
      .filter((entry): entry is string => Boolean(entry));
  }

  const single = coerceString(value);
  return single ? [single] : [];
}

function collectOrganizations(user: User): string[] {
  const sources: Array<Record<string, unknown>> = [];
  if (user.app_metadata && typeof user.app_metadata === 'object') {
    sources.push(user.app_metadata as Record<string, unknown>);
  }
  if (user.user_metadata && typeof user.user_metadata === 'object') {
    sources.push(user.user_metadata as Record<string, unknown>);
  }

  const keys = [
    'org_id',
    'orgId',
    'organizationId',
    'organization_id',
    'org',
    'orgs',
    'organizations',
    'admin_org',
    'admin_orgs',
    'allowed_orgs',
    'org_ids',
  ];

  const collected = new Set<string>();
  for (const source of sources) {
    for (const key of keys) {
      if (!(key in source)) continue;
      const value = source[key];
      for (const entry of collectStringValues(value)) {
        collected.add(entry);
      }
    }
  }

  if (collected.size === 0 && typeof user.app_metadata?.tenant_id === 'string') {
    collected.add(user.app_metadata.tenant_id);
  }

  return Array.from(collected);
}

function collectRoles(user: User): string[] {
  const sources: Array<Record<string, unknown>> = [];
  if (user.app_metadata && typeof user.app_metadata === 'object') {
    sources.push(user.app_metadata as Record<string, unknown>);
  }
  if (user.user_metadata && typeof user.user_metadata === 'object') {
    sources.push(user.user_metadata as Record<string, unknown>);
  }

  const collected = new Set<string>();
  const keys = ['role', 'roles', 'admin_roles', 'permissions'];

  for (const source of sources) {
    for (const key of keys) {
      if (!(key in source)) continue;
      const value = source[key];
      const roles = collectStringValues(value);
      roles.forEach((role) => collected.add(role.toLowerCase()));
    }

    if (source.admin === true || source.is_admin === true) {
      collected.add('admin');
    }
    if (source.super_admin === true) {
      collected.add('super_admin');
    }
    if (source.admin_panel === true) {
      collected.add('admin_panel');
    }
  }

  return Array.from(collected);
}

function deriveActorId(user: User): string | null {
  const candidateFields = [
    user.app_metadata?.actor_id,
    user.app_metadata?.actor,
    user.user_metadata?.actor_id,
    user.user_metadata?.actor,
    user.email,
    user.user_metadata?.email,
  ];

  for (const candidate of candidateFields) {
    const value = coerceString(candidate);
    if (value) return value;
  }

  return user.id ?? null;
}

export async function getSupabaseSession(request?: Request): Promise<SupabaseAdminSession | null> {
  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    return null;
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  const organizations = collectOrganizations(data.user);
  const roles = collectRoles(data.user);
  const actorId = deriveActorId(data.user);

  return {
    user: data.user,
    accessToken,
    organizations,
    roles,
    actorId,
  };
}
