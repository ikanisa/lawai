import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppAssembly } from '../src/types/fastify.js';

describe('Vector Store Search API', () => {
  let app: AppAssembly;

  beforeEach(async () => {
    // Force stub mode for tests
    process.env.AGENT_STUB_MODE = 'always';
    app = await createApp();
  });

  afterEach(async () => {
    await app.instance.close();
  });

  describe('POST /api/vector-stores/:vectorStoreId/search', () => {
    it('should return 400 if request body is invalid', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_123/search',
        payload: {
          // Missing required query field
          max_num_results: 5,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_request');
    });

    it('should return 400 if vector store id is missing', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores//search',
        payload: {
          query: 'test query',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should perform basic search with mock data', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'contract execution requirements',
          max_num_results: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.object).toBe('vector_store.search_results.page');
      expect(body.search_query).toBeTruthy();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.has_more).toBeDefined();
      
      // Check first result structure
      const firstResult = body.data[0];
      expect(firstResult.file_id).toBeTruthy();
      expect(firstResult.filename).toBeTruthy();
      expect(typeof firstResult.score).toBe('number');
      expect(Array.isArray(firstResult.content)).toBe(true);
    });

    it('should support query rewriting', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'contract execution requirements',
          max_num_results: 5,
          rewrite_query: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Mock implementation adds [rewritten] suffix when rewrite_query is true
      expect(body.search_query).toContain('contract execution requirements');
    });

    it('should support attribute filtering', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'legal requirements',
          max_num_results: 10,
          attribute_filter: {
            type: 'eq',
            key: 'jurisdiction',
            value: 'OHADA',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should support compound filters', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'legal requirements',
          max_num_results: 10,
          attribute_filter: {
            type: 'and',
            filters: [
              {
                type: 'eq',
                key: 'jurisdiction',
                value: 'OHADA',
              },
              {
                type: 'gte',
                key: 'date',
                value: 1672531200,
              },
            ],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should support ranking options', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'legal requirements',
          max_num_results: 10,
          ranking_options: {
            ranker: 'auto',
            score_threshold: 0.7,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // With score threshold of 0.7, results should have scores >= 0.7
      if (body.data.length > 0) {
        for (const result of body.data) {
          expect(result.score).toBeGreaterThanOrEqual(0.7);
        }
      }
    });

    it('should respect max_num_results', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'legal requirements',
          max_num_results: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeLessThanOrEqual(1);
    });

    it('should reject max_num_results > 50', async () => {
      const response = await app.instance.inject({
        method: 'POST',
        url: '/api/vector-stores/vs_test/search',
        payload: {
          query: 'test',
          max_num_results: 100,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_request');
    });
  });
});
