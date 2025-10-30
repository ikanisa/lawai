/**
 * Web Search Routes
 * 
 * HTTP endpoints for web search functionality
 */

import { z } from 'zod';
import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import {
  UserLocationSchema,
  OFFICIAL_DOMAIN_ALLOWLIST,
} from '@avocat-ai/shared';
import { performWebSearch, validateAllowedDomains } from '../../services/web-search.js';

const WebSearchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  model: z.string().optional(),
  allowedDomains: z.array(z.string()).max(20).optional(),
  userLocation: UserLocationSchema.optional(),
  externalWebAccess: z.boolean().optional(),
  maxOutputTokens: z.number().int().min(1).max(32000).optional(),
});

type WebSearchRequestBody = z.infer<typeof WebSearchRequestSchema>;

/**
 * Register web search routes
 */
export async function registerWebSearchRoutes(
  app: AppFastifyInstance,
  _ctx: AppContext,
) {
  /**
   * POST /web-search
   * 
   * Perform a web search with optional domain filtering and user location
   */
  app.post('/web-search', async (request, reply) => {
    const parseResult = WebSearchRequestSchema.safeParse(request.body ?? {});
    
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        details: parseResult.error.flatten(),
      });
    }

    const body = parseResult.data as WebSearchRequestBody;

    // Validate allowed domains if provided
    if (body.allowedDomains) {
      const validation = validateAllowedDomains(body.allowedDomains);
      if (validation.invalid.length > 0) {
        return reply.code(400).send({
          error: 'invalid_domains',
          invalid: validation.invalid,
          message: 'Some domains are not valid hostnames',
        });
      }
      body.allowedDomains = validation.valid;
    }

    try {
      const result = await performWebSearch(
        {
          query: body.query,
          model: body.model,
          allowedDomains: body.allowedDomains,
          userLocation: body.userLocation,
          externalWebAccess: body.externalWebAccess,
          maxOutputTokens: body.maxOutputTokens,
        },
        request.log,
      );

      return reply.send({
        query: body.query,
        text: result.text,
        citations: result.citations,
        sources: result.sources,
        searchCallId: result.searchCallId,
        action: result.action,
      });
    } catch (error) {
      request.log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'web_search_error',
      );

      return reply.code(500).send({
        error: 'web_search_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /web-search/domains
   * 
   * Get the list of official allowed domains
   */
  app.get('/web-search/domains', async (_request, reply) => {
    return reply.send({
      domains: OFFICIAL_DOMAIN_ALLOWLIST,
      count: OFFICIAL_DOMAIN_ALLOWLIST.length,
    });
  });

  /**
   * POST /web-search/validate-domains
   * 
   * Validate a list of domain names
   */
  app.post('/web-search/validate-domains', async (request, reply) => {
    const body = request.body as { domains?: unknown };
    
    if (!Array.isArray(body.domains)) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'domains must be an array',
      });
    }

    const domains = body.domains.filter((d): d is string => typeof d === 'string');
    const validation = validateAllowedDomains(domains);

    return reply.send({
      valid: validation.valid,
      invalid: validation.invalid,
      validCount: validation.valid.length,
      invalidCount: validation.invalid.length,
    });
  });
}
