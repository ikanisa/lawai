import { isAdminPanelEnabled, getAdminEnvironmentLabel } from '../../config/feature-flags';
import { getSupabaseRouteSession } from '../supabase/session';
import type { RouteSession } from '../supabase/session';

export interface AdminContext {
  orgId: string;
  actorId: string;
  environment: 'development' | 'staging' | 'production';
}

export class AdminAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function ensureAdminEnabled() {
  if (!isAdminPanelEnabled()) {
    throw new AdminAccessError('Admin panel is disabled', 404);
  }
}

function hasAdminCapability(session: RouteSession): boolean {
  const metadata = {
    ...(session.user.app_metadata ?? {}),
    ...(session.user.user_metadata ?? {}),
  } as Record<string, unknown>;
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles.map(String)
    : typeof metadata.roles === 'string'
      ? metadata.roles.split(',').map((value) => value.trim())
      : [];
  const capabilities = Array.isArray(metadata.capabilities)
    ? metadata.capabilities.map(String)
    : typeof metadata.capabilities === 'string'
      ? metadata.capabilities.split(',').map((value) => value.trim())
      : [];

  if (metadata.admin === true || metadata.is_admin === true) {
    return true;
  }
  if (roles.some((role) => role.toLowerCase() === 'admin')) {
    return true;
  }
  if (capabilities.some((capability) => capability.toLowerCase() === 'admin')) {
    return true;
  }
  return false;
}

function deriveOrgId(request: Request, session: RouteSession): string | null {
  const headerOrg = request.headers.get('x-admin-org');
  if (headerOrg?.trim()) {
    return headerOrg.trim();
  }
  const urlOrg = new URL(request.url).searchParams.get('orgId');
  if (urlOrg?.trim()) {
    return urlOrg.trim();
  }
  const metadata = {
    ...(session.user.app_metadata ?? {}),
    ...(session.user.user_metadata ?? {}),
  } as Record<string, unknown>;
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
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function deriveActorId(request: Request, session: RouteSession): string {
  const headerActor = request.headers.get('x-admin-actor');
  if (headerActor?.trim()) {
    return headerActor.trim();
  }
  const metadata = {
    ...(session.user.app_metadata ?? {}),
    ...(session.user.user_metadata ?? {}),
  } as Record<string, unknown>;
  const metadataActor =
    (typeof metadata.actor_id === 'string' && metadata.actor_id.trim().length > 0
      ? metadata.actor_id
      : typeof metadata.actorId === 'string' && metadata.actorId.trim().length > 0
        ? metadata.actorId
        : null);
  if (metadataActor) {
    return metadataActor.trim();
  }
  if (session.user.email?.trim()) {
    return session.user.email.trim();
  }
  return session.user.id;
}

export async function requireAdminContext(request: Request): Promise<AdminContext> {
  ensureAdminEnabled();
  const session = await getSupabaseRouteSession(request);
  if (!session) {
    throw new AdminAccessError('Missing or invalid session', 401);
  }

  if (!hasAdminCapability(session)) {
    throw new AdminAccessError('Admin access required', 403);
  }

  const orgId = deriveOrgId(request, session);
  if (!orgId) {
    throw new AdminAccessError('Organization scope is required', 403);
  }

  const actorId = deriveActorId(request, session);

  return {
    orgId,
    actorId,
    environment: getAdminEnvironmentLabel(),
  };
}

export function respond(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export function respondError(error: unknown) {
  if (error instanceof AdminAccessError) {
    return new Response(error.message, { status: error.status });
  }
  console.error('Admin API error', error);
  return new Response('Internal server error', { status: 500 });
}
