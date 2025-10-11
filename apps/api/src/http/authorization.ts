import type { FastifyRequest } from 'fastify';
import { authorizeAction, ensureOrgAccessCompliance } from '../access-control.js';
import type { OrgAccessContext } from '../access-control.js';
import { recordDeviceSession } from '../device-sessions.js';

async function applyRequestContext<T extends OrgAccessContext>(
  access: T,
  request: FastifyRequest,
): Promise<T> {
  ensureOrgAccessCompliance(access, {
    ip: request.ip,
    headers: request.headers as Record<string, unknown>,
  });

  try {
    await recordDeviceSession({ orgId: access.orgId, userId: access.userId, role: access.role, request });
  } catch (error) {
    request.log.error({ err: error, orgId: access.orgId, userId: access.userId }, 'device_session_record_failed');
  }

  return access;
}

export async function authorizeRequestWithGuards(
  action: Parameters<typeof authorizeAction>[0],
  orgId: string,
  userId: string,
  request: FastifyRequest,
): Promise<OrgAccessContext> {
  const access = await authorizeAction(action, orgId, userId);
  return applyRequestContext(access, request);
}
