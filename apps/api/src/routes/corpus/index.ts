import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { fetchCorpusDashboard, searchVectorStore } from './data.js';

export async function registerCorpusRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/corpus', async () => cloneCorpusDashboardResponse());

  app.post('/corpus/search', async (request, reply) => {
    try {
      const result = await searchVectorStore(request.body ?? {});
      return result;
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({ error: 'search_failed', message: error.message });
      }
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
}
