import type { AppFastifyInstance } from '../../types/fastify.js';

import type { AppContext } from '../../types/context.js';
import { cloneMattersData } from './data.js';

export async function registerMattersRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/matters', async () => cloneMattersData());
}
