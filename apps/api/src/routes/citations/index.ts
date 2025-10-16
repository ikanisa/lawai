import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../../types/context.js';
import { cloneCitationsData } from './data.js';

export async function registerCitationsRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get('/citations', async () => cloneCitationsData());
}
