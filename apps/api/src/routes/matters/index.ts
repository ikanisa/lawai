import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../../types/context.js';
import { cloneMattersData } from './data.js';

export async function registerMattersRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get('/matters', async () => cloneMattersData());
}
