import type { FastifyRequest } from 'fastify';
import { authorizeAction } from '../access-control.js';
import type { OrgAccessContext } from '../access-control.js';
export declare function authorizeRequestWithGuards(action: Parameters<typeof authorizeAction>[0], orgId: string, userId: string, request: FastifyRequest): Promise<OrgAccessContext>;
//# sourceMappingURL=authorization.d.ts.map