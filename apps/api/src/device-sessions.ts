import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import { supabase } from './supabase-client.js';

type RecordDeviceSessionParams = {
  orgId: string;
  userId: string;
  role: string;
  request: FastifyRequest;
};

type DeviceSessionRow = {
  id: string;
  org_id: string;
  user_id: string;
  session_token: string;
  device_fingerprint: string;
  device_label: string | null;
  user_agent: string | null;
  platform: string | null;
  client_version: string | null;
  ip_address: string | null;
  auth_strength: string | null;
  mfa_method: string | null;
  attested: boolean | null;
  passkey: boolean | null;
  metadata: Record<string, unknown>;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
};

const SESSION_CONFLICT_TARGET = 'org_id,session_token';

function normaliseHeader(headers: Record<string, unknown>, key: string): string | null {
  const value = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : null;
  }
  return typeof value === 'string' ? value.trim() : null;
}

function deriveSessionToken(orgId: string, userId: string, baseToken: string | null, fingerprint: string): string {
  const candidate = baseToken?.trim();
  if (candidate) {
    return candidate;
  }

  const hash = createHash('sha256');
  hash.update(`${orgId}:${userId}:${fingerprint}`);
  return hash.digest('hex');
}

function deriveFingerprint(userId: string, userAgent: string | null, deviceId: string | null): string {
  const hash = createHash('sha256');
  hash.update(userId);
  hash.update(':');
  hash.update(deviceId ?? '');
  hash.update(':');
  hash.update(userAgent ?? '');
  return hash.digest('hex');
}

function booleanFromHeader(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function resolveIpAddress(ip: string | undefined, headerIp: string | null): string | null {
  if (headerIp && headerIp.trim().length > 0) {
    return headerIp.trim();
  }
  return ip && ip.length > 0 ? ip : null;
}

export async function recordDeviceSession(params: RecordDeviceSessionParams): Promise<void> {
  const { orgId, userId, role, request } = params;
  const headers = request.headers as unknown as Record<string, unknown>;

  const userAgent = normaliseHeader(headers, 'user-agent');
  const declaredDeviceId = normaliseHeader(headers, 'x-device-id');
  const sessionHeader = normaliseHeader(headers, 'x-session-id');
  const deviceLabel = normaliseHeader(headers, 'x-device-label');
  const platform = normaliseHeader(headers, 'x-device-platform');
  const clientVersion = normaliseHeader(headers, 'x-client-version');
  const authStrength = normaliseHeader(headers, 'x-auth-strength');
  const mfaMethod = normaliseHeader(headers, 'x-mfa-method');
  const attested = booleanFromHeader(normaliseHeader(headers, 'x-device-attested'));
  const passkey = booleanFromHeader(normaliseHeader(headers, 'x-passkey'));
  const ipOverride = normaliseHeader(headers, 'x-forwarded-for');
  const ipAddress = resolveIpAddress(request.ip, ipOverride);

  const fingerprint = deriveFingerprint(userId, userAgent, declaredDeviceId);
  const sessionToken = deriveSessionToken(orgId, userId, sessionHeader, fingerprint);

  const metadata: Record<string, unknown> = {
    role,
    headers: {
      device_id: declaredDeviceId,
      session_id: sessionHeader,
      platform,
      client_version: clientVersion,
    },
  };

  const nowIso = new Date().toISOString();

  const upsertResult = await supabase
    .from('device_sessions')
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        session_token: sessionToken,
        device_fingerprint: fingerprint,
        device_label: deviceLabel,
        user_agent: userAgent,
        platform,
        client_version: clientVersion,
        ip_address: ipAddress,
        auth_strength: authStrength,
        mfa_method: mfaMethod,
        attested,
        passkey,
        metadata,
        last_seen_at: nowIso,
      },
      { onConflict: SESSION_CONFLICT_TARGET },
    );

  if (upsertResult.error) {
    request.log.error({ err: upsertResult.error, orgId, userId }, 'device_session_upsert_failed');
  }
}

type ListDeviceSessionsParams = {
  orgId: string;
  limit?: number;
  includeRevoked?: boolean;
  userId?: string;
};

export async function listDeviceSessions(
  client: SupabaseClient,
  params: ListDeviceSessionsParams,
): Promise<DeviceSessionRow[]> {
  const { orgId, limit = 100, includeRevoked = false, userId } = params;

  let query = client
    .from('device_sessions')
    .select(
      'id, org_id, user_id, session_token, device_fingerprint, device_label, user_agent, platform, client_version, ip_address, auth_strength, mfa_method, attested, passkey, metadata, created_at, last_seen_at, expires_at, revoked_at, revoked_by, revoked_reason',
    )
    .eq('org_id', orgId)
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (!includeRevoked) {
    query = query.is('revoked_at', null);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as DeviceSessionRow[];
}

type RevokeDeviceSessionParams = {
  orgId: string;
  sessionId: string;
  actorUserId: string;
  reason?: string | null;
};

export async function revokeDeviceSession(
  client: SupabaseClient,
  params: RevokeDeviceSessionParams,
): Promise<DeviceSessionRow | null> {
  const { orgId, sessionId, actorUserId, reason } = params;
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from('device_sessions')
    .update({
      revoked_at: nowIso,
      revoked_by: actorUserId,
      revoked_reason: reason ?? null,
    })
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .select(
      'id, org_id, user_id, session_token, device_fingerprint, device_label, user_agent, platform, client_version, ip_address, auth_strength, mfa_method, attested, passkey, metadata, created_at, last_seen_at, expires_at, revoked_at, revoked_by, revoked_reason',
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as DeviceSessionRow) ?? null;
}
