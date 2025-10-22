import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { cloneResearchContext } from './data.js';

export async function registerResearchRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/research/context', async (_request, _reply) => {
    return cloneResearchContext();
  });
}
