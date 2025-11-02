import type { AppFastifyInstance } from '../../types/fastify.js';
import { ensureCsrfCookie } from '../../security/policies.js';

export async function registerSecurityRoutes(app: AppFastifyInstance): Promise<void> {
  app.get('/security/csrf', async (request, reply) => {
    const token = ensureCsrfCookie(request, reply);
    return { token };
  });
}
