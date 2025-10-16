import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../../types/context.js';
import { cloneCorpusDashboardResponse } from './data.js';

export async function registerCorpusRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get('/corpus', async () => cloneCorpusDashboardResponse());
}
