import { SearchRequestSchema, type SearchRequest } from '@avocat-ai/shared';
import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { getOpenAI } from '../../openai.js';
import { searchVectorStore, mockSearchVectorStore } from '../../services/semantic-search.js';

/**
 * Register vector store routes including semantic search
 */
export async function registerVectorStoreRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  /**
   * POST /vector-stores/:vectorStoreId/search
   * 
   * Perform semantic search on a vector store using natural language queries.
   * Supports query rewriting, attribute filtering, and ranking options.
   * 
   * Example request:
   * {
   *   "query": "What are the contract execution requirements?",
   *   "max_num_results": 10,
   *   "rewrite_query": true,
   *   "attribute_filter": {
   *     "type": "eq",
   *     "key": "jurisdiction",
   *     "value": "OHADA"
   *   },
   *   "ranking_options": {
   *     "ranker": "auto",
   *     "score_threshold": 0.7
   *   }
   * }
   */
  app.post('/vector-stores/:vectorStoreId/search', async (request, reply) => {
    const { vectorStoreId } = request.params as { vectorStoreId: string };
    
    if (!vectorStoreId) {
      return reply.code(400).send({ error: 'vector_store_id_required' });
    }

    // Parse and validate request body
    const parseResult = SearchRequestSchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        details: parseResult.error.flatten(),
      });
    }

    const searchRequest = parseResult.data as SearchRequest;

    try {
      // Check if we should use mock mode
      const useMock = process.env.AGENT_STUB_MODE === 'always' || 
                     (process.env.AGENT_STUB_MODE === 'auto' && !process.env.OPENAI_API_KEY);

      if (useMock) {
        const mockResult = mockSearchVectorStore(vectorStoreId, searchRequest);
        return reply.send(mockResult);
      }

      // Use real OpenAI client
      const client = getOpenAI();
      const result = await searchVectorStore(client, vectorStoreId, searchRequest);
      
      return reply.send(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      
      if (errorMessage.includes('vector_store_search_unavailable')) {
        return reply.code(503).send({
          error: 'vector_store_search_unavailable',
          message: 'Vector store search API is not available',
        });
      }

      return reply.code(500).send({
        error: 'search_failed',
        message: errorMessage,
      });
    }
  });
}
