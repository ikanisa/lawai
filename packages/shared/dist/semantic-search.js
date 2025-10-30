import { z } from 'zod';
/**
 * Comparison filter operators for attribute-based filtering
 */
export const ComparisonOperatorSchema = z.enum([
    'eq', // equal
    'ne', // not equal
    'gt', // greater than
    'gte', // greater than or equal
    'lt', // less than
    'lte', // less than or equal
    'in', // in array
    'nin', // not in array
]);
/**
 * Comparison filter for attribute-based filtering
 */
export const ComparisonFilterSchema = z.object({
    type: ComparisonOperatorSchema,
    key: z.string().describe('Attribute key to filter on'),
    value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number()])),
    ]).describe('Value to compare against'),
});
/**
 * Compound filter that combines multiple filters with logical operators
 */
export const CompoundFilterSchema = z.lazy(() => z.object({
    type: z.enum(['and', 'or']).describe('Logical operator'),
    filters: z.array(z.union([ComparisonFilterSchema, CompoundFilterSchema])).describe('Array of filters to combine'),
}));
/**
 * Attribute filter - can be either comparison or compound
 */
export const AttributeFilterSchema = z.union([
    ComparisonFilterSchema,
    CompoundFilterSchema,
]);
/**
 * Ranking options for semantic search
 */
export const RankingOptionsSchema = z.object({
    ranker: z.enum(['auto', 'default-2024-08-21']).optional().describe('Ranker to use'),
    score_threshold: z.number().min(0.0).max(1.0).optional().describe('Minimum similarity score (0.0-1.0)'),
});
/**
 * Content chunk in search result
 */
export const ContentChunkSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});
/**
 * Individual search result
 */
export const SearchResultSchema = z.object({
    file_id: z.string(),
    filename: z.string(),
    score: z.number().describe('Similarity score'),
    attributes: z.record(z.unknown()).optional().describe('File attributes'),
    content: z.array(ContentChunkSchema).describe('Content chunks'),
});
/**
 * Search results response
 */
export const SearchResultsResponseSchema = z.object({
    object: z.literal('vector_store.search_results.page'),
    search_query: z.string().describe('Query used (may be rewritten)'),
    data: z.array(SearchResultSchema),
    has_more: z.boolean(),
    next_page: z.string().nullable(),
});
/**
 * Search request parameters
 */
export const SearchRequestSchema = z.object({
    query: z.string().min(1).describe('Natural language search query'),
    max_num_results: z.number().int().min(1).max(50).default(10).describe('Maximum results to return'),
    rewrite_query: z.boolean().optional().describe('Enable automatic query rewriting'),
    attribute_filter: AttributeFilterSchema.optional().describe('Filter results by attributes'),
    ranking_options: RankingOptionsSchema.optional().describe('Ranking configuration'),
});
/**
 * Helper to format search results for display
 */
export function formatSearchResultsForLLM(results) {
    let formatted = '<sources>';
    for (const result of results) {
        formatted += `<result file_id='${result.file_id}' file_name='${result.filename}' score='${result.score}'>`;
        for (const chunk of result.content) {
            formatted += `<content>${chunk.text}</content>`;
        }
        formatted += '</result>';
    }
    formatted += '</sources>';
    return formatted;
}
/**
 * Helper to create a simple comparison filter
 */
export function createComparisonFilter(key, operator, value) {
    return {
        type: operator,
        key,
        value,
    };
}
/**
 * Helper to create a compound filter
 */
export function createCompoundFilter(operator, filters) {
    return {
        type: operator,
        filters,
    };
}
