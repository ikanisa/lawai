import { z } from 'zod';
export declare const ComparisonOperatorSchema: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
export declare const LogicalOperatorSchema: z.ZodEnum<["and", "or"]>;
export declare const ComparisonFilterSchema: z.ZodObject<{
    type: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]>;
    key: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, "many">]>;
}, "strip", z.ZodTypeAny, {
    type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";
    key: string;
    value: string | number | boolean | (string | number | boolean)[];
}, {
    type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";
    key: string;
    value: string | number | boolean | (string | number | boolean)[];
}>;
export type CompoundFilterType = z.infer<typeof ComparisonFilterSchema> | {
    type: z.infer<typeof LogicalOperatorSchema>;
    filters: Array<CompoundFilterType>;
};
export declare const CompoundFilterSchema: z.ZodType<CompoundFilterType>;
export declare const AttributeFilterSchema: z.ZodType<CompoundFilterType, z.ZodTypeDef, CompoundFilterType>;
export declare const RankingOptionsSchema: z.ZodObject<{
    ranker: z.ZodOptional<z.ZodEnum<["auto", "default-2024-08-21"]>>;
    score_threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    ranker?: "auto" | "default-2024-08-21" | undefined;
    score_threshold?: number | undefined;
}, {
    ranker?: "auto" | "default-2024-08-21" | undefined;
    score_threshold?: number | undefined;
}>;
export declare const ChunkingStrategySchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"static">;
    max_chunk_size_tokens: z.ZodNumber;
    chunk_overlap_tokens: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "static";
    max_chunk_size_tokens: number;
    chunk_overlap_tokens: number;
}, {
    type: "static";
    max_chunk_size_tokens: number;
    chunk_overlap_tokens: number;
}>, {
    type: "static";
    max_chunk_size_tokens: number;
    chunk_overlap_tokens: number;
}, {
    type: "static";
    max_chunk_size_tokens: number;
    chunk_overlap_tokens: number;
}>;
export declare const SearchContentItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
    type: "text";
}, {
    text: string;
    type: "text";
}>;
export declare const SearchResultSchema: z.ZodObject<{
    file_id: z.ZodString;
    filename: z.ZodString;
    score: z.ZodNumber;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
        type: "text";
    }, {
        text: string;
        type: "text";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    file_id: string;
    filename: string;
    score: number;
    content: {
        text: string;
        type: "text";
    }[];
    attributes?: Record<string, string | number | boolean> | undefined;
}, {
    file_id: string;
    filename: string;
    score: number;
    content: {
        text: string;
        type: "text";
    }[];
    attributes?: Record<string, string | number | boolean> | undefined;
}>;
export declare const SearchResultsPageSchema: z.ZodObject<{
    object: z.ZodLiteral<"vector_store.search_results.page">;
    search_query: z.ZodString;
    data: z.ZodArray<z.ZodObject<{
        file_id: z.ZodString;
        filename: z.ZodString;
        score: z.ZodNumber;
        attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
        content: z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            type: "text";
        }, {
            text: string;
            type: "text";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        file_id: string;
        filename: string;
        score: number;
        content: {
            text: string;
            type: "text";
        }[];
        attributes?: Record<string, string | number | boolean> | undefined;
    }, {
        file_id: string;
        filename: string;
        score: number;
        content: {
            text: string;
            type: "text";
        }[];
        attributes?: Record<string, string | number | boolean> | undefined;
    }>, "many">;
    has_more: z.ZodBoolean;
    next_page: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    object: "vector_store.search_results.page";
    search_query: string;
    data: {
        file_id: string;
        filename: string;
        score: number;
        content: {
            text: string;
            type: "text";
        }[];
        attributes?: Record<string, string | number | boolean> | undefined;
    }[];
    has_more: boolean;
    next_page: string | null;
}, {
    object: "vector_store.search_results.page";
    search_query: string;
    data: {
        file_id: string;
        filename: string;
        score: number;
        content: {
            text: string;
            type: "text";
        }[];
        attributes?: Record<string, string | number | boolean> | undefined;
    }[];
    has_more: boolean;
    next_page: string | null;
}>;
export declare const SearchParamsSchema: z.ZodObject<{
    query: z.ZodString;
    rewrite_query: z.ZodOptional<z.ZodBoolean>;
    attribute_filter: z.ZodOptional<z.ZodType<CompoundFilterType, z.ZodTypeDef, CompoundFilterType>>;
    ranking_options: z.ZodOptional<z.ZodObject<{
        ranker: z.ZodOptional<z.ZodEnum<["auto", "default-2024-08-21"]>>;
        score_threshold: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ranker?: "auto" | "default-2024-08-21" | undefined;
        score_threshold?: number | undefined;
    }, {
        ranker?: "auto" | "default-2024-08-21" | undefined;
        score_threshold?: number | undefined;
    }>>;
    max_num_results: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    rewrite_query?: boolean | undefined;
    attribute_filter?: CompoundFilterType | undefined;
    ranking_options?: {
        ranker?: "auto" | "default-2024-08-21" | undefined;
        score_threshold?: number | undefined;
    } | undefined;
    max_num_results?: number | undefined;
}, {
    query: string;
    rewrite_query?: boolean | undefined;
    attribute_filter?: CompoundFilterType | undefined;
    ranking_options?: {
        ranker?: "auto" | "default-2024-08-21" | undefined;
        score_threshold?: number | undefined;
    } | undefined;
    max_num_results?: number | undefined;
}>;
export type ComparisonFilterSchemaType = z.infer<typeof ComparisonFilterSchema>;
export type RankingOptionsSchemaType = z.infer<typeof RankingOptionsSchema>;
export type ChunkingStrategySchemaType = z.infer<typeof ChunkingStrategySchema>;
export type SearchContentItemSchemaType = z.infer<typeof SearchContentItemSchema>;
export type SearchResultSchemaType = z.infer<typeof SearchResultSchema>;
export type SearchResultsPageSchemaType = z.infer<typeof SearchResultsPageSchema>;
export type SearchParamsSchemaType = z.infer<typeof SearchParamsSchema>;
//# sourceMappingURL=vector-store-schemas.d.ts.map