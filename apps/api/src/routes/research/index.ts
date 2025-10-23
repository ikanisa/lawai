import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { cloneResearchContext, getResearchFilters } from './data.js';
import { getVectorStoreClient } from '../../openai.js';

const ResearchSearchFiltersSchema = z
  .object({
    publicationDates: z.array(z.string()).min(1).optional(),
    entryIntoForce: z.array(z.string()).min(1).optional(),
  })
  .default({});

const ResearchSearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5),
  filters: ResearchSearchFiltersSchema.optional(),
});

type ResearchSearchRequest = z.infer<typeof ResearchSearchRequestSchema>;

interface VectorStoreQueryResultItem {
  id?: string;
  score?: number | string;
  document?: {
    id?: string;
    title?: string;
    href?: string;
    url?: string;
    link?: string;
    snippet?: string;
    summary?: string;
  };
  attributes?: Record<string, unknown>;
}

interface VectorStoreQueryResult {
  rewrittenQuery?: string;
  rewritten_query?: string;
  data?: VectorStoreQueryResultItem[];
  availableFilters?: unknown;
  available_filters?: unknown;
}

function normalizeVectorStoreResultItem(item: VectorStoreQueryResultItem, index: number) {
  const document = item.document ?? {};
  const rawScore = typeof item.score === 'number' ? item.score : Number.parseFloat(String(item.score ?? '0'));
  const score = Number.isFinite(rawScore) ? rawScore : 0;

  return {
    id: document.id ?? item.id ?? `result-${index}`,
    title: document.title ?? '',
    href: document.href ?? document.url ?? document.link ?? null,
    snippet: document.snippet ?? document.summary ?? '',
    score,
    rank: index + 1,
    attributes: item.attributes ?? {},
  };
}

export async function registerResearchRoutes(app: AppFastifyInstance, _ctx: AppContext) {
  app.get('/research/context', async (_request, _reply) => {
    return cloneResearchContext();
  });

  app.post('/research/search', async (request, reply) => {
    const parse = ResearchSearchRequestSchema.safeParse(request.body ?? {});
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parse.error.flatten() });
    }

    const { query, limit, filters } = parse.data as ResearchSearchRequest;
    const appliedFilters = filters ?? {};
    const vectorStore = getVectorStoreClient();

    const vectorResponse = (await vectorStore.query({
      query,
      limit,
      filters: appliedFilters,
    })) as VectorStoreQueryResult;

    const defaultFilters = getResearchFilters();
    const availableFilters = (vectorResponse.availableFilters ?? vectorResponse.available_filters ?? defaultFilters) as Record<
      string,
      unknown
    >;

    const results = Array.isArray(vectorResponse.data)
      ? vectorResponse.data.map((item, index) => normalizeVectorStoreResultItem(item, index))
      : [];

    return {
      query,
      rewrittenQuery: vectorResponse.rewrittenQuery ?? vectorResponse.rewritten_query ?? query,
      results,
      filters: {
        applied: appliedFilters,
        available: availableFilters,
      },
    };
  });
}
