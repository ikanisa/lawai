import type { Session } from '@supabase/supabase-js';

export interface AdminSessionDetails {
  accessToken: string;
  userId: string;
  actorId: string;
  email: string | null;
  orgId: string | null;
  roles: string[];
  capabilities: string[];
  metadata: Record<string, unknown>;
}

let currentSession: AdminSessionDetails | null = null;
let initialized = false;
const waiters = new Set<(value: AdminSessionDetails | null) => void>();

function toArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function extractOrgId(metadata: Record<string, unknown>): string | null {
  const candidates = [
    metadata.org_id,
    metadata.orgId,
    metadata.organization_id,
    metadata.organizationId,
    metadata.org,
    metadata.organization,
    metadata.default_org_id,
    metadata.defaultOrgId,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function deriveActorId(user: Session['user'], metadata: Record<string, unknown>): string {
  if (typeof metadata.actor_id === 'string' && metadata.actor_id.trim().length > 0) {
    return metadata.actor_id;
  }
  if (typeof metadata.actorId === 'string' && metadata.actorId.trim().length > 0) {
    return metadata.actorId;
  }
  if (typeof user.email === 'string' && user.email.trim().length > 0) {
    return user.email;
  }
  return user.id;
}

export function mapSessionToDetails(session: Session | null): AdminSessionDetails | null {
  if (!session) return null;
  const { user } = session;
  if (!user) return null;
  const metadata = { ...(user.app_metadata ?? {}), ...(user.user_metadata ?? {}) } as Record<string, unknown>;
  const roles = toArray(metadata.roles);
  const capabilities = toArray(metadata.capabilities);
  return {
    accessToken: session.access_token,
    userId: user.id,
    actorId: deriveActorId(user, metadata),
    email: user.email ?? null,
    orgId: extractOrgId(metadata),
    roles,
    capabilities,
    metadata,
  };
}

export function setAdminSessionState(session: Session | null) {
  currentSession = mapSessionToDetails(session);
  initialized = true;
  for (const waiter of waiters) {
    waiter(currentSession);
  }
  waiters.clear();
}

export function getAdminSessionState(): AdminSessionDetails | null {
  return currentSession;
}

export async function waitForAdminSession(): Promise<AdminSessionDetails | null> {
  if (initialized) {
    return currentSession;
  }
  return new Promise<AdminSessionDetails | null>((resolve) => {
    waiters.add(resolve);
  });
}
