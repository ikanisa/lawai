import { z } from 'zod';
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
function normalizeVectorStoreResultItem(item, index) {
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
export async function registerResearchRoutes(app, _ctx) {
    app.get('/research/context', async (_request, _reply) => {
        return cloneResearchContext();
    });
    app.post('/research/search', async (request, reply) => {
        const parse = ResearchSearchRequestSchema.safeParse(request.body ?? {});
        if (!parse.success) {
            return reply.code(400).send({ error: 'invalid_request', details: parse.error.flatten() });
        }
        const { query, limit, filters } = parse.data;
        const appliedFilters = filters ?? {};
        const vectorStore = getVectorStoreClient();
        const vectorResponse = (await vectorStore.query({
            query,
            limit,
            filters: appliedFilters,
        }));
        const defaultFilters = getResearchFilters();
        const availableFilters = (vectorResponse.availableFilters ?? vectorResponse.available_filters ?? defaultFilters);
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
