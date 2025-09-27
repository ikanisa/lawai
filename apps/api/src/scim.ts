import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
import { logAuditEvent } from './audit.js';
import { resolveScimToken } from './sso.js';

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

const DEFAULT_ROLE = 'member';

function normaliseRole(role?: string | null): string {
  if (!role) return DEFAULT_ROLE;
  const lower = role.toLowerCase();
  switch (lower) {
    case 'owner':
    case 'admin':
    case 'member':
    case 'reviewer':
    case 'viewer':
    case 'compliance_officer':
    case 'auditor':
      return lower;
    default:
      return DEFAULT_ROLE;
  }
}

function parseRoleFromPayload(payload: any): string {
  if (!payload) return DEFAULT_ROLE;
  if (Array.isArray(payload.roles) && payload.roles.length > 0) {
    const direct = payload.roles.find((entry: any) => typeof entry?.value === 'string');
    if (direct?.value) {
      return normaliseRole(direct.value);
    }
  }
  const enterprise = payload['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
  if (enterprise && Array.isArray(enterprise.roles)) {
    const entry = enterprise.roles.find((item: any) => typeof item?.value === 'string');
    if (entry?.value) {
      return normaliseRole(entry.value);
    }
  }
  if (typeof payload.role === 'string') {
    return normaliseRole(payload.role);
  }
  return DEFAULT_ROLE;
}

function extractEmail(payload: any): string | null {
  if (!payload) return null;
  if (Array.isArray(payload.emails)) {
    const primary = payload.emails.find((entry: any) => entry?.primary);
    if (primary?.value && typeof primary.value === 'string') {
      return primary.value;
    }
    const first = payload.emails.find((entry: any) => typeof entry?.value === 'string');
    if (first?.value) {
      return first.value;
    }
  }
  if (typeof payload.email === 'string') {
    return payload.email;
  }
  return null;
}

function extractName(payload: any): { fullName: string | null; givenName: string | null; familyName: string | null } {
  if (!payload) {
    return { fullName: null, givenName: null, familyName: null };
  }
  if (typeof payload.displayName === 'string') {
    return { fullName: payload.displayName, givenName: null, familyName: null };
  }
  const name = payload.name;
  if (name && typeof name === 'object') {
    const formatted = typeof name.formatted === 'string' ? name.formatted : null;
    const given = typeof name.givenName === 'string' ? name.givenName : null;
    const family = typeof name.familyName === 'string' ? name.familyName : null;
    const fallbackName = [given, family].filter(Boolean).join(' ').trim();
    const fullName = formatted ?? (fallbackName.length > 0 ? fallbackName : null);
    return { fullName, givenName: given, familyName: family };
  }
  return { fullName: null, givenName: null, familyName: null };
}

async function upsertProfile(userId: string, payload: any) {
  const email = extractEmail(payload);
  const { fullName } = extractName(payload);
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    email,
    full_name: fullName,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`profile_upsert_failed:${error.message}`);
  }
}

function formatScimUser(row: any) {
  const email = row.profiles?.email ?? null;
  const fullName = row.profiles?.full_name ?? null;
  const created = row.created_at ?? new Date().toISOString();
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: row.user_id,
    userName: email ?? row.user_id,
    active: true,
    name: {
      formatted: fullName ?? row.user_id,
    },
    emails: email ? [{ value: email, primary: true }] : [],
    roles: [{ value: row.role }],
    meta: {
      resourceType: 'User',
      created,
      lastModified: row.updated_at ?? created,
    },
  };
}

export async function listScimUsers(authHeader: string) {
  const context = await resolveBearer(authHeader);
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id, role, created_at, profiles(email, full_name, updated_at)')
    .eq('org_id', context.orgId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`scim_users_list_failed:${error.message}`);
  }

  const resources = (data ?? []).map((row) => formatScimUser(row));
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: resources.length,
    itemsPerPage: resources.length,
    startIndex: 1,
    Resources: resources,
  };
}

async function resolveBearer(authHeader: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('scim_auth_required');
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Error('scim_auth_required');
  }
  const context = await resolveScimToken(token);
  if (!context) {
    throw new Error('scim_auth_invalid');
  }
  return context;
}

export async function createScimUser(authHeader: string, payload: any) {
  const context = await resolveBearer(authHeader);
  const userId = typeof payload?.id === 'string' && payload.id.length > 0 ? payload.id : randomUUID();
  const role = parseRoleFromPayload(payload);

  await upsertProfile(userId, payload);

  const { data, error } = await supabase
    .from('org_members')
    .upsert({ org_id: context.orgId, user_id: userId, role })
    .select('user_id, role, created_at, profiles(email, full_name, updated_at)')
    .maybeSingle();

  if (error) {
    throw new Error(`scim_create_user_failed:${error.message}`);
  }

  await logAuditEvent({
    orgId: context.orgId,
    actorId: context.tokenId,
    kind: 'scim.user.created',
    object: userId,
    after: { role, payload },
  });

  return formatScimUser(data ?? { user_id: userId, role, profiles: { email: extractEmail(payload), full_name: extractName(payload).fullName } });
}

async function ensureMembership(orgId: string, userId: string) {
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, user_id, role, created_at, profiles(email, full_name, updated_at)')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`scim_lookup_failed:${error.message}`);
  }

  return data;
}

export async function patchScimUser(authHeader: string, userId: string, payload: any) {
  const context = await resolveBearer(authHeader);
  const membership = await ensureMembership(context.orgId, userId);
  if (!membership) {
    throw new Error('scim_user_not_found');
  }

  let active: boolean | null = null;
  let newRole: string | null = null;
  let profileUpdates: any = null;

  const operations = Array.isArray(payload?.Operations) ? payload.Operations : [];
  for (const operation of operations) {
    const op = typeof operation?.op === 'string' ? operation.op.toLowerCase() : '';
    const path = typeof operation?.path === 'string' ? operation.path.toLowerCase() : '';
    if (op === 'replace') {
      if (path === 'active' || path === 'urn:ietf:params:scim:schemas:core:2.0:user:active') {
        active = Boolean(operation.value ?? operation.Value ?? operation.value?.active);
      } else if (path.startsWith('roles') || path.includes('role')) {
        const value = operation.value ?? operation.Value;
        if (Array.isArray(value)) {
          newRole = parseRoleFromPayload({ roles: value });
        } else if (typeof value === 'string') {
          newRole = parseRoleFromPayload({ role: value });
        }
      } else if (path.startsWith('emails') || path.includes('name')) {
        profileUpdates = operation.value ?? operation.Value;
      } else if (!path && typeof operation.value === 'object') {
        profileUpdates = operation.value;
      }
    }
  }

  if (profileUpdates) {
    await upsertProfile(userId, { ...membership.profiles, ...profileUpdates });
  }

  if (newRole) {
    const { error } = await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('org_id', context.orgId)
      .eq('user_id', userId);
    if (error) {
      throw new Error(`scim_update_role_failed:${error.message}`);
    }
    await logAuditEvent({
      orgId: context.orgId,
      actorId: context.tokenId,
      kind: 'scim.user.role_updated',
      object: userId,
      before: { role: membership.role },
      after: { role: newRole },
    });
  }

  if (active === false) {
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', context.orgId)
      .eq('user_id', userId);
    if (error) {
      throw new Error(`scim_deactivate_failed:${error.message}`);
    }
    await logAuditEvent({
      orgId: context.orgId,
      actorId: context.tokenId,
      kind: 'scim.user.deactivated',
      object: userId,
    });
    return { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: userId, active: false };
  }

  const refreshed = await ensureMembership(context.orgId, userId);
  return formatScimUser(refreshed ?? { user_id: userId, role: newRole ?? membership.role });
}

export async function deleteScimUser(authHeader: string, userId: string) {
  const context = await resolveBearer(authHeader);
  const membership = await ensureMembership(context.orgId, userId);
  if (!membership) {
    return { status: 'ok' };
  }
  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('org_id', context.orgId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(`scim_delete_user_failed:${error.message}`);
  }
  await logAuditEvent({
    orgId: context.orgId,
    actorId: context.tokenId,
    kind: 'scim.user.deleted',
    object: userId,
    before: { role: membership.role },
  });
  return { status: 'ok' };
}
