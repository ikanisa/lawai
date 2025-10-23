import type { AppFastifyInstance } from '../../types/fastify.js';

import type { AppContext } from '../../types/context.js';
import { fetchCorpusDashboard } from './data.js';

export async function registerCorpusRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/corpus', async () => cloneCorpusDashboardResponse());
}
