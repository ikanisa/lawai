import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
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
export declare function recordDeviceSession(params: RecordDeviceSessionParams): Promise<void>;
type ListDeviceSessionsParams = {
    orgId: string;
    limit?: number;
    includeRevoked?: boolean;
    userId?: string;
};
export declare function listDeviceSessions(client: SupabaseClient, params: ListDeviceSessionsParams): Promise<DeviceSessionRow[]>;
type RevokeDeviceSessionParams = {
    orgId: string;
    sessionId: string;
    actorUserId: string;
    reason?: string | null;
};
export declare function revokeDeviceSession(client: SupabaseClient, params: RevokeDeviceSessionParams): Promise<DeviceSessionRow | null>;
export {};
//# sourceMappingURL=device-sessions.d.ts.map