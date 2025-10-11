import { randomBytes, createHash } from 'node:crypto';
import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
import { logAuditEvent } from './audit.js';

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

const ALLOWED_ROLES = new Set([
  'owner',
  'admin',
  'member',
  'reviewer',
  'viewer',
  'compliance_officer',
  'auditor',
]);

type Provider = 'saml' | 'oidc';

interface SsoConnectionRow {
  id: string;
  org_id: string;
  provider: Provider;
  label: string | null;
  metadata: Record<string, unknown> | null;
  acs_url: string | null;
  entity_id: string | null;
  client_id: string | null;
  client_secret?: string | null;
  default_role: string;
  group_mappings: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

interface ScimTokenRow {
  id: string;
  org_id: string;
  expires_at: string | null;
}

export interface SsoConnectionInput {
  id?: string;
  provider: Provider;
  label?: string;
  metadata?: Record<string, unknown>;
  acsUrl?: string;
  entityId?: string;
  clientId?: string;
  clientSecret?: string;
  defaultRole?: string;
  groupMappings?: Record<string, string>;
}

export interface ScimTokenRecord {
  id: string;
  name: string;
  createdAt: string;
  createdBy?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sanitizeRole(role: string | undefined): string {
  if (!role) return 'member';
  if (ALLOWED_ROLES.has(role)) return role;
  return 'member';
}

function sanitizeConnection(row: SsoConnectionRow) {
  return {
    id: row.id,
    orgId: row.org_id,
    provider: row.provider,
    label: row.label,
    metadata: row.metadata ?? {},
    acsUrl: row.acs_url,
    entityId: row.entity_id,
    clientId: row.client_id,
    defaultRole: row.default_role,
    groupMappings: row.group_mappings ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSsoConnections(orgId: string) {
  const { data, error } = await supabase
    .from('sso_connections')
    .select(
      'id, org_id, provider, label, metadata, acs_url, entity_id, client_id, default_role, group_mappings, created_at, updated_at',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`sso_list_failed:${error.message}`);
  }

  return (data ?? []).map((row: any) => sanitizeConnection(row as SsoConnectionRow));
}

export async function upsertSsoConnection(orgId: string, actorId: string, input: SsoConnectionInput) {
  const payload = {
    org_id: orgId,
    provider: input.provider,
    label: input.label ?? null,
    metadata: input.metadata ?? {},
    acs_url: input.acsUrl ?? null,
    entity_id: input.entityId ?? null,
    client_id: input.clientId ?? null,
    client_secret: input.clientSecret ?? null,
    default_role: sanitizeRole(input.defaultRole),
    group_mappings: input.groupMappings ?? {},
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: before } = await supabase
      .from('sso_connections')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('sso_connections')
      .update(payload)
      .eq('org_id', orgId)
      .eq('id', input.id)
      .select(
        'id, org_id, provider, label, metadata, acs_url, entity_id, client_id, default_role, group_mappings, created_at, updated_at',
      )
      .maybeSingle();

    if (error) {
      throw new Error(`sso_update_failed:${error.message}`);
    }

    await logAuditEvent({
      orgId,
      actorId,
      kind: 'sso.updated',
      object: input.id,
      before: before ?? undefined,
      after: data ?? undefined,
    });

    if (!data) {
      return null;
    }

    return sanitizeConnection(data as SsoConnectionRow);
  }

  const insertPayload = { ...payload };
  const { data, error } = await supabase
    .from('sso_connections')
    .insert(insertPayload)
    .select(
      'id, org_id, provider, label, metadata, acs_url, entity_id, client_id, default_role, group_mappings, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    throw new Error(`sso_create_failed:${error.message}`);
  }

  if (!data) {
    throw new Error('sso_create_failed:empty');
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'sso.created',
    object: data.id as string,
    after: data,
  });

  return sanitizeConnection(data as SsoConnectionRow);
}

export async function deleteSsoConnection(orgId: string, actorId: string, id: string) {
  const { data, error } = await supabase
    .from('sso_connections')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id, provider, label, default_role')
    .maybeSingle();

  if (error) {
    throw new Error(`sso_delete_failed:${error.message}`);
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'sso.deleted',
    object: id,
    before: data ?? undefined,
  });
}

export async function listScimTokens(orgId: string): Promise<ScimTokenRecord[]> {
  const { data, error } = await supabase
    .from('scim_tokens')
    .select('id, name, created_by, created_at, expires_at, last_used_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`scim_list_failed:${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    name: row.name as string,
    createdBy: row.created_by as string | null | undefined,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string | null | undefined,
    lastUsedAt: row.last_used_at as string | null | undefined,
  }));
}

export async function createScimToken(orgId: string, actorId: string, name: string, expiresAt?: string | null) {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);

  const insertPayload = {
    org_id: orgId,
    name,
    token_hash: tokenHash,
    created_by: actorId,
    expires_at: expiresAt ?? null,
  };

  const { data, error } = await supabase
    .from('scim_tokens')
    .insert(insertPayload)
    .select('id, name, created_at, expires_at')
    .maybeSingle();

  if (error) {
    throw new Error(`scim_create_failed:${error.message}`);
  }

  if (!data) {
    throw new Error('scim_create_failed:empty');
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'scim.token.created',
    object: data.id as string,
    after: data,
  });

  return {
    id: data.id as string,
    token: rawToken,
    expiresAt: data.expires_at as string | null | undefined,
  };
}

export async function deleteScimToken(orgId: string, actorId: string, id: string) {
  const { data, error } = await supabase
    .from('scim_tokens')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id, name')
    .maybeSingle();

  if (error) {
    throw new Error(`scim_delete_failed:${error.message}`);
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'scim.token.deleted',
    object: id,
    before: data ?? undefined,
  });
}

export interface IpAllowlistInput {
  id?: string;
  cidr: string;
  description?: string | null;
}

export async function listIpAllowlist(orgId: string) {
  const { data, error } = await supabase
    .from('ip_allowlist_entries')
    .select('id, cidr, description, created_at, created_by')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`ip_allowlist_list_failed:${error.message}`);
  }

  return data ?? [];
}

export async function upsertIpAllowlist(orgId: string, actorId: string, input: IpAllowlistInput) {
  const payload = {
    org_id: orgId,
    cidr: input.cidr,
    description: input.description ?? null,
    created_by: actorId,
  };

  if (input.id) {
    const { data: before } = await supabase
      .from('ip_allowlist_entries')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', input.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('ip_allowlist_entries')
      .update({
        cidr: input.cidr,
        description: input.description ?? null,
      })
      .eq('org_id', orgId)
      .eq('id', input.id)
      .select('id, cidr, description, created_at, created_by')
      .maybeSingle();

    if (error) {
      throw new Error(`ip_allowlist_update_failed:${error.message}`);
    }

    await logAuditEvent({
      orgId,
      actorId,
      kind: 'ip.allowlist.updated',
      object: input.id,
      before: before ?? undefined,
      after: data ?? undefined,
    });

    return data;
  }

  const { data, error } = await supabase
    .from('ip_allowlist_entries')
    .insert(payload)
    .select('id, cidr, description, created_at, created_by')
    .maybeSingle();

  if (error) {
    throw new Error(`ip_allowlist_create_failed:${error.message}`);
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'ip.allowlist.created',
    object: (data?.id as string) ?? 'unknown',
    after: data ?? undefined,
  });

  return data;
}

export async function deleteIpAllowlist(orgId: string, actorId: string, id: string) {
  const { data, error } = await supabase
    .from('ip_allowlist_entries')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id, cidr, description')
    .maybeSingle();

  if (error) {
    throw new Error(`ip_allowlist_delete_failed:${error.message}`);
  }

  await logAuditEvent({
    orgId,
    actorId,
    kind: 'ip.allowlist.deleted',
    object: id,
    before: data ?? undefined,
  });
}

export async function resolveScimToken(rawToken: string): Promise<{ tokenId: string; orgId: string } | null> {
  const tokenHash = hashToken(rawToken);
  const { data, error } = await supabase
    .from('scim_tokens')
    .select('id, org_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`scim_lookup_failed:${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as ScimTokenRow;
  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt) && expiresAt < Date.now()) {
    return null;
  }

  await supabase
    .from('scim_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id);

  return {
    tokenId: row.id,
    orgId: row.org_id,
  };
}
