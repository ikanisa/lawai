import { isAdminPanelEnabled, getAdminEnvironmentLabel } from '../../config/feature-flags';
import { serverEnv } from '../../env.server';

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

export async function requireAdminContext(request: Request): Promise<AdminContext> {
  ensureAdminEnabled();
  const fallbackActor =
    serverEnv.NODE_ENV !== 'production' ? 'dev-admin@local' : serverEnv.ADMIN_PANEL_ACTOR ?? '';
  const actorId = request.headers.get('x-admin-actor') ?? serverEnv.ADMIN_PANEL_ACTOR ?? fallbackActor;
  if (!actorId) {
    throw new AdminAccessError('Missing admin actor header', 401);
  }
  const orgId =
    request.headers.get('x-admin-org') ??
    new URL(request.url).searchParams.get('orgId') ??
    serverEnv.ADMIN_PANEL_ORG ??
    'org-demo';

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
