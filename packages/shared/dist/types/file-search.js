/**
 * File Search Types for OpenAI Responses API
 * Based on OpenAI documentation for file search functionality
 */
import { z } from 'zod';
/**
 * File search tool configuration for Responses API
 */
export const FileSearchToolSchema = z.object({
    type: z.literal('file_search'),
    vector_store_ids: z.array(z.string()).min(1, 'At least one vector store ID is required'),
    max_num_results: z.number().int().positive().optional(),
    filters: z
        .object({
        type: z.enum(['in', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte']),
        key: z.string(),
        value: z.union([z.string(), z.number(), z.array(z.string())]),
    })
        .optional(),
});
/**
 * File citation annotation
 */
export const FileCitationSchema = z.object({
    type: z.literal('file_citation'),
    index: z.number().int().nonnegative(),
    file_id: z.string(),
    filename: z.string(),
});
/**
 * Search result item from file search
 */
export const FileSearchResultItemSchema = z.object({
    file_id: z.string(),
    filename: z.string().optional(),
    score: z.number().optional(),
    content: z.string().optional(),
});
/**
 * File search call output item
 */
export const FileSearchCallItemSchema = z.object({
    type: z.literal('file_search_call'),
    id: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed']),
    queries: z.array(z.string()).optional(),
    search_results: z.array(FileSearchResultItemSchema).nullable().optional(),
});
/**
 * Message content with text and file citations
 */
export const FileSearchMessageContentSchema = z.object({
    type: z.literal('output_text'),
    text: z.string(),
    annotations: z.array(FileCitationSchema).optional(),
});
/**
 * Message output item for file search
 */
export const FileSearchMessageItemSchema = z.object({
    id: z.string(),
    type: z.literal('message'),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed']).optional(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.array(FileSearchMessageContentSchema),
});
/**
 * File search response output union
 */
export const FileSearchOutputItemSchema = z.discriminatedUnion('type', [
    FileSearchCallItemSchema,
    FileSearchMessageItemSchema,
]);
/**
 * File search error codes
 */
export const FILE_SEARCH_ERROR_CODES = {
    INVALID_REQUEST: 'file_search_invalid_request',
    API_ERROR: 'file_search_api_error',
    NO_RESULTS: 'file_search_no_results',
    QUOTA_EXCEEDED: 'file_search_quota_exceeded',
    VECTOR_STORE_ERROR: 'file_search_vector_store_error',
    INVALID_VECTOR_STORE: 'file_search_invalid_vector_store',
};
