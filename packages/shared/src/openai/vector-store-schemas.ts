import { z } from 'zod';

// Comparison operators
export const ComparisonOperatorSchema = z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin']);

// Logical operators
export const LogicalOperatorSchema = z.enum(['and', 'or']);

// Base comparison filter schema
export const ComparisonFilterSchema = z.object({
  type: ComparisonOperatorSchema,
  key: z.string().min(1),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]),
});

// Compound filter schema with recursive type
export const CompoundFilterSchema: z.ZodSchema = z.lazy(() =>
  z.union([
    ComparisonFilterSchema,
    z.object({
      type: LogicalOperatorSchema,
      filters: z.array(CompoundFilterSchema),
    }),
  ])
);

// Attribute filter (comparison or compound)
export const AttributeFilterSchema = CompoundFilterSchema;

// Ranking options schema
export const RankingOptionsSchema = z.object({
  ranker: z.enum(['auto', 'default-2024-08-21']).optional(),
  score_threshold: z.number().min(0.0).max(1.0).optional(),
});

// Chunking strategy schema
export const ChunkingStrategySchema = z.object({
  type: z.literal('static'),
  max_chunk_size_tokens: z.number().int().min(100).max(4096),
  chunk_overlap_tokens: z.number().int().min(0),
}).refine(
  (data) => data.chunk_overlap_tokens <= data.max_chunk_size_tokens / 2,
  {
    message: 'chunk_overlap_tokens must not exceed max_chunk_size_tokens / 2',
  }
);

// Search content item schema
export const SearchContentItemSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

// Search result schema
export const SearchResultSchema = z.object({
  file_id: z.string(),
  filename: z.string(),
  score: z.number(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  content: z.array(SearchContentItemSchema),
});

// Search results page schema
export const SearchResultsPageSchema = z.object({
  object: z.literal('vector_store.search_results.page'),
  search_query: z.string(),
  data: z.array(SearchResultSchema),
  has_more: z.boolean(),
  next_page: z.string().nullable(),
});

// Search parameters schema
export const SearchParamsSchema = z.object({
  query: z.string().min(1),
  rewrite_query: z.boolean().optional(),
  attribute_filter: AttributeFilterSchema.optional(),
  ranking_options: RankingOptionsSchema.optional(),
  max_num_results: z.number().int().min(1).max(50).optional(),
});

// Export types inferred from schemas
export type ComparisonFilterSchemaType = z.infer<typeof ComparisonFilterSchema>;
export type RankingOptionsSchemaType = z.infer<typeof RankingOptionsSchema>;
export type ChunkingStrategySchemaType = z.infer<typeof ChunkingStrategySchema>;
export type SearchContentItemSchemaType = z.infer<typeof SearchContentItemSchema>;
export type SearchResultSchemaType = z.infer<typeof SearchResultSchema>;
export type SearchResultsPageSchemaType = z.infer<typeof SearchResultsPageSchema>;
export type SearchParamsSchemaType = z.infer<typeof SearchParamsSchema>;
