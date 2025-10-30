import { z } from 'zod';
/**
 * Comparison filter operators for attribute-based filtering
 */
export declare const ComparisonOperatorSchema: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;
/**
 * Comparison filter for attribute-based filtering
 */
export declare const ComparisonFilterSchema: z.ZodObject<{
    type: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
    key: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>;
}, "strip", z.ZodTypeAny, {
    type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
    key?: string;
    value?: string | number | boolean | (string | number)[];
}, {
    type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
    key?: string;
    value?: string | number | boolean | (string | number)[];
}>;
export type ComparisonFilter = z.infer<typeof ComparisonFilterSchema>;
/**
 * Compound filter that combines multiple filters with logical operators
 * Type definition comes first for recursive reference
 */
export type CompoundFilter = {
    type: 'and' | 'or';
    filters: Array<ComparisonFilter | CompoundFilter>;
};
/**
 * Compound filter schema - recursive definition using z.lazy
 */
export declare const CompoundFilterSchema: z.ZodType<CompoundFilter, z.ZodTypeDef, CompoundFilter>;
/**
 * Attribute filter - can be either comparison or compound
 */
export declare const AttributeFilterSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
    key: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>;
}, "strip", z.ZodTypeAny, {
    type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
    key?: string;
    value?: string | number | boolean | (string | number)[];
}, {
    type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
    key?: string;
    value?: string | number | boolean | (string | number)[];
}>, z.ZodType<CompoundFilter, z.ZodTypeDef, CompoundFilter>]>;
export type AttributeFilter = ComparisonFilter | CompoundFilter;
/**
 * Ranking options for semantic search
 */
export declare const RankingOptionsSchema: z.ZodObject<{
    ranker: z.ZodOptional<z.ZodEnum<["auto", "default-2024-08-21"]>>;
    score_threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    ranker?: "auto" | "default-2024-08-21";
    score_threshold?: number;
}, {
    ranker?: "auto" | "default-2024-08-21";
    score_threshold?: number;
}>;
export type RankingOptions = z.infer<typeof RankingOptionsSchema>;
/**
 * Content chunk in search result
 */
export declare const ContentChunkSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type?: "text";
    text?: string;
}, {
    type?: "text";
    text?: string;
}>;
export type ContentChunk = z.infer<typeof ContentChunkSchema>;
/**
 * Individual search result
 */
export declare const SearchResultSchema: z.ZodObject<{
    file_id: z.ZodString;
    filename: z.ZodString;
    score: z.ZodNumber;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "text";
        text?: string;
    }, {
        type?: "text";
        text?: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    filename?: string;
    content?: {
        type?: "text";
        text?: string;
    }[];
    attributes?: Record<string, unknown>;
    file_id?: string;
    score?: number;
}, {
    filename?: string;
    content?: {
        type?: "text";
        text?: string;
    }[];
    attributes?: Record<string, unknown>;
    file_id?: string;
    score?: number;
}>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
/**
 * Search results response
 */
export declare const SearchResultsResponseSchema: z.ZodObject<{
    object: z.ZodLiteral<"vector_store.search_results.page">;
    search_query: z.ZodString;
    data: z.ZodArray<z.ZodObject<{
        file_id: z.ZodString;
        filename: z.ZodString;
        score: z.ZodNumber;
        attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        content: z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type?: "text";
            text?: string;
        }, {
            type?: "text";
            text?: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        filename?: string;
        content?: {
            type?: "text";
            text?: string;
        }[];
        attributes?: Record<string, unknown>;
        file_id?: string;
        score?: number;
    }, {
        filename?: string;
        content?: {
            type?: "text";
            text?: string;
        }[];
        attributes?: Record<string, unknown>;
        file_id?: string;
        score?: number;
    }>, "many">;
    has_more: z.ZodBoolean;
    next_page: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    object?: "vector_store.search_results.page";
    data?: {
        filename?: string;
        content?: {
            type?: "text";
            text?: string;
        }[];
        attributes?: Record<string, unknown>;
        file_id?: string;
        score?: number;
    }[];
    search_query?: string;
    has_more?: boolean;
    next_page?: string;
}, {
    object?: "vector_store.search_results.page";
    data?: {
        filename?: string;
        content?: {
            type?: "text";
            text?: string;
        }[];
        attributes?: Record<string, unknown>;
        file_id?: string;
        score?: number;
    }[];
    search_query?: string;
    has_more?: boolean;
    next_page?: string;
}>;
export type SearchResultsResponse = z.infer<typeof SearchResultsResponseSchema>;
/**
 * Search request parameters
 */
export declare const SearchRequestSchema: z.ZodObject<{
    query: z.ZodString;
    max_num_results: z.ZodDefault<z.ZodNumber>;
    rewrite_query: z.ZodOptional<z.ZodBoolean>;
    attribute_filter: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        type: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
        key: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>;
    }, "strip", z.ZodTypeAny, {
        type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
        key?: string;
        value?: string | number | boolean | (string | number)[];
    }, {
        type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
        key?: string;
        value?: string | number | boolean | (string | number)[];
    }>, z.ZodType<CompoundFilter, z.ZodTypeDef, CompoundFilter>]>>;
    ranking_options: z.ZodOptional<z.ZodObject<{
        ranker: z.ZodOptional<z.ZodEnum<["auto", "default-2024-08-21"]>>;
        score_threshold: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ranker?: "auto" | "default-2024-08-21";
        score_threshold?: number;
    }, {
        ranker?: "auto" | "default-2024-08-21";
        score_threshold?: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    max_num_results?: number;
    rewrite_query?: boolean;
    attribute_filter?: {
        type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
        key?: string;
        value?: string | number | boolean | (string | number)[];
    } | CompoundFilter;
    ranking_options?: {
        ranker?: "auto" | "default-2024-08-21";
        score_threshold?: number;
    };
}, {
    query?: string;
    max_num_results?: number;
    rewrite_query?: boolean;
    attribute_filter?: {
        type?: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "nin";
        key?: string;
        value?: string | number | boolean | (string | number)[];
    } | CompoundFilter;
    ranking_options?: {
        ranker?: "auto" | "default-2024-08-21";
        score_threshold?: number;
    };
}>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
/**
 * Helper to format search results for display
 */
export declare function formatSearchResultsForLLM(results: SearchResult[]): string;
/**
 * Helper to create a simple comparison filter
 */
export declare function createComparisonFilter(key: string, operator: ComparisonOperator, value: string | number | boolean | (string | number)[]): ComparisonFilter;
/**
 * Helper to create a compound filter
 */
export declare function createCompoundFilter(operator: 'and' | 'or', filters: AttributeFilter[]): CompoundFilter;
