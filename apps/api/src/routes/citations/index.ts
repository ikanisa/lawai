import type { AppFastifyInstance } from '../../types/fastify.js';

import type { AppContext } from '../../types/context.js';
import { cloneCitationsData } from './data.js';

export async function registerCitationsRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/citations', async () => cloneCitationsData());
}
