/**
 * File Search Types for OpenAI Responses API
 * Based on OpenAI documentation for file search functionality
 */
import { z } from 'zod';
/**
 * File search tool configuration for Responses API
 */
export declare const FileSearchToolSchema: z.ZodObject<{
    type: z.ZodLiteral<"file_search">;
    vector_store_ids: z.ZodArray<z.ZodString, "many">;
    max_num_results: z.ZodOptional<z.ZodNumber>;
    filters: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["in", "eq", "ne", "gt", "gte", "lt", "lte"]>;
        key: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | string[];
        type: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
        key: string;
    }, {
        value: string | number | string[];
        type: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
        key: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "file_search";
    vector_store_ids: string[];
    filters?: {
        value: string | number | string[];
        type: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
        key: string;
    } | undefined;
    max_num_results?: number | undefined;
}, {
    type: "file_search";
    vector_store_ids: string[];
    filters?: {
        value: string | number | string[];
        type: "in" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
        key: string;
    } | undefined;
    max_num_results?: number | undefined;
}>;
export type FileSearchTool = z.infer<typeof FileSearchToolSchema>;
/**
 * File citation annotation
 */
export declare const FileCitationSchema: z.ZodObject<{
    type: z.ZodLiteral<"file_citation">;
    index: z.ZodNumber;
    file_id: z.ZodString;
    filename: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "file_citation";
    filename: string;
    index: number;
    file_id: string;
}, {
    type: "file_citation";
    filename: string;
    index: number;
    file_id: string;
}>;
export type FileCitation = z.infer<typeof FileCitationSchema>;
/**
 * Search result item from file search
 */
export declare const FileSearchResultItemSchema: z.ZodObject<{
    file_id: z.ZodString;
    filename: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodNumber>;
    content: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file_id: string;
    score?: number | undefined;
    content?: string | undefined;
    filename?: string | undefined;
}, {
    file_id: string;
    score?: number | undefined;
    content?: string | undefined;
    filename?: string | undefined;
}>;
export type FileSearchResultItem = z.infer<typeof FileSearchResultItemSchema>;
/**
 * File search call output item
 */
export declare const FileSearchCallItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"file_search_call">;
    id: z.ZodString;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    queries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    search_results: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        file_id: z.ZodString;
        filename: z.ZodOptional<z.ZodString>;
        score: z.ZodOptional<z.ZodNumber>;
        content: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }, {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: "file_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    queries?: string[] | undefined;
    search_results?: {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }[] | null | undefined;
}, {
    type: "file_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    queries?: string[] | undefined;
    search_results?: {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }[] | null | undefined;
}>;
export type FileSearchCallItem = z.infer<typeof FileSearchCallItemSchema>;
/**
 * Message content with text and file citations
 */
export declare const FileSearchMessageContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"output_text">;
    text: z.ZodString;
    annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"file_citation">;
        index: z.ZodNumber;
        file_id: z.ZodString;
        filename: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "file_citation";
        filename: string;
        index: number;
        file_id: string;
    }, {
        type: "file_citation";
        filename: string;
        index: number;
        file_id: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "output_text";
    text: string;
    annotations?: {
        type: "file_citation";
        filename: string;
        index: number;
        file_id: string;
    }[] | undefined;
}, {
    type: "output_text";
    text: string;
    annotations?: {
        type: "file_citation";
        filename: string;
        index: number;
        file_id: string;
    }[] | undefined;
}>;
export type FileSearchMessageContent = z.infer<typeof FileSearchMessageContentSchema>;
/**
 * Message output item for file search
 */
export declare const FileSearchMessageItemSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"message">;
    status: z.ZodOptional<z.ZodEnum<["queued", "in_progress", "completed", "failed"]>>;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"output_text">;
        text: z.ZodString;
        annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"file_citation">;
            index: z.ZodNumber;
            file_id: z.ZodString;
            filename: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }, {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }, {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    id: string;
    content: {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }[];
    role: "user" | "assistant" | "system";
    status?: "queued" | "completed" | "failed" | "in_progress" | undefined;
}, {
    type: "message";
    id: string;
    content: {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }[];
    role: "user" | "assistant" | "system";
    status?: "queued" | "completed" | "failed" | "in_progress" | undefined;
}>;
export type FileSearchMessageItem = z.infer<typeof FileSearchMessageItemSchema>;
/**
 * File search response output union
 */
export declare const FileSearchOutputItemSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"file_search_call">;
    id: z.ZodString;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    queries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    search_results: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        file_id: z.ZodString;
        filename: z.ZodOptional<z.ZodString>;
        score: z.ZodOptional<z.ZodNumber>;
        content: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }, {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: "file_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    queries?: string[] | undefined;
    search_results?: {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }[] | null | undefined;
}, {
    type: "file_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    queries?: string[] | undefined;
    search_results?: {
        file_id: string;
        score?: number | undefined;
        content?: string | undefined;
        filename?: string | undefined;
    }[] | null | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"message">;
    status: z.ZodOptional<z.ZodEnum<["queued", "in_progress", "completed", "failed"]>>;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"output_text">;
        text: z.ZodString;
        annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"file_citation">;
            index: z.ZodNumber;
            file_id: z.ZodString;
            filename: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }, {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }, {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    id: string;
    content: {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }[];
    role: "user" | "assistant" | "system";
    status?: "queued" | "completed" | "failed" | "in_progress" | undefined;
}, {
    type: "message";
    id: string;
    content: {
        type: "output_text";
        text: string;
        annotations?: {
            type: "file_citation";
            filename: string;
            index: number;
            file_id: string;
        }[] | undefined;
    }[];
    role: "user" | "assistant" | "system";
    status?: "queued" | "completed" | "failed" | "in_progress" | undefined;
}>]>;
export type FileSearchOutputItem = z.infer<typeof FileSearchOutputItemSchema>;
/**
 * File search request parameters
 */
export interface FileSearchRequest {
    query: string;
    vectorStoreIds: string[];
    model?: string;
    maxNumResults?: number;
    filters?: {
        type: 'in' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
        key: string;
        value: string | number | string[];
    };
    includeSearchResults?: boolean;
    maxOutputTokens?: number;
}
/**
 * Processed file search result
 */
export interface FileSearchResult {
    text: string;
    citations: FileCitation[];
    searchResults?: FileSearchResultItem[];
    searchCallId?: string;
}
/**
 * File search error codes
 */
export declare const FILE_SEARCH_ERROR_CODES: {
    readonly INVALID_REQUEST: "file_search_invalid_request";
    readonly API_ERROR: "file_search_api_error";
    readonly NO_RESULTS: "file_search_no_results";
    readonly QUOTA_EXCEEDED: "file_search_quota_exceeded";
    readonly VECTOR_STORE_ERROR: "file_search_vector_store_error";
    readonly INVALID_VECTOR_STORE: "file_search_invalid_vector_store";
};
export type FileSearchErrorCode = (typeof FILE_SEARCH_ERROR_CODES)[keyof typeof FILE_SEARCH_ERROR_CODES];
//# sourceMappingURL=file-search.d.ts.map