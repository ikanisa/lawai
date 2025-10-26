import { isAdminPanelEnabled, getAdminEnvironmentLabel } from '../../config/feature-flags';
import { getSupabaseSession } from '../supabase/session';

export interface AdminContext {
  orgId: string;
  actorId: string;
  environment: 'development' | 'staging' | 'production';
  roles: string[];
  organizations: string[];
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

export async function requireAdminContext(request: Request): Promise<AdminContext> {
  ensureAdminEnabled();
  const session = await getSupabaseSession(request);
  if (!session) {
    throw new AdminAccessError('Missing or invalid admin session', 401);
  }

  const normalizedRoles = new Set(session.roles.map((role) => role.toLowerCase()));
  const adminRoles = ['admin', 'org_admin', 'super_admin', 'admin_panel'];
  const hasAdminRole = adminRoles.some((role) => normalizedRoles.has(role));
  const metadata = {
    ...(session.user.app_metadata ?? {}),
    ...(session.user.user_metadata ?? {}),
  } as Record<string, unknown>;

  if (!hasAdminRole && metadata.admin !== true && metadata.is_admin !== true) {
    throw new AdminAccessError('Admin privileges required', 403);
  }

  const allowedOrgIds = new Set<string>(session.organizations);
  const metadataOrgKeys = [
    'org_id',
    'orgId',
    'organizationId',
    'organization_id',
    'org',
    'admin_org',
    'tenant_id',
  ];
  for (const key of metadataOrgKeys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      allowedOrgIds.add(value.trim());
    }
  }
  const metadataOrgArrays = ['orgs', 'organizations', 'admin_orgs', 'allowed_orgs', 'org_ids'];
  for (const key of metadataOrgArrays) {
    const value = metadata[key];
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && entry.trim()) {
          allowedOrgIds.add(entry.trim());
        }
      });
    }
  }

  const queryOrg = new URL(request.url).searchParams.get('orgId');
  const headerOrg = request.headers.get('x-admin-org');
  const requestedOrg = headerOrg ?? queryOrg ?? null;

  let orgId: string | null = null;
  if (requestedOrg) {
    if (allowedOrgIds.size > 0 && !allowedOrgIds.has(requestedOrg)) {
      throw new AdminAccessError('Unauthorized organization scope', 403);
    }
    orgId = requestedOrg;
  } else if (allowedOrgIds.size > 0) {
    orgId = allowedOrgIds.values().next().value ?? null;
  }

  if (!orgId) {
    throw new AdminAccessError('Organization context is missing', 403);
  }

  const actorId = session.actorId ?? session.user.email ?? session.user.id;
  if (!actorId) {
    throw new AdminAccessError('Unable to resolve admin actor', 401);
  }

  return {
    orgId,
    actorId,
    environment: getAdminEnvironmentLabel(),
    roles: Array.from(normalizedRoles),
    organizations: Array.from(allowedOrgIds),
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
