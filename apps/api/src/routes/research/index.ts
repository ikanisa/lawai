import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../types/context.js';
import { cloneResearchContext } from './data.js';

export async function registerResearchRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get('/research/context', async (_request, _reply) => {
    return cloneResearchContext();
  });
}
