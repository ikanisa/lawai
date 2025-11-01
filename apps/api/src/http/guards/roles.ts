import type { FastifyReply } from 'fastify';
import type { OrgAccessContext, OrgRole } from '../../access-control.js';

export interface RoleGuardOptions {
  onDeniedMessage?: string;
}

type GuardResult = {
  allowed: boolean;
};

export function createRoleGuard(requiredRoles: OrgRole[], options: RoleGuardOptions = {}) {
  const message = options.onDeniedMessage ?? 'insufficient_role';

  return function ensureRole(access: OrgAccessContext, reply: FastifyReply): GuardResult {
    if (requiredRoles.includes(access.role)) {
      return { allowed: true };
    }

    void reply.code(403).send({ error: 'forbidden', message });
    return { allowed: false };
  };
}
