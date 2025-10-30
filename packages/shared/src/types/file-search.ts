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

export type FileSearchTool = z.infer<typeof FileSearchToolSchema>;

/**
 * File citation annotation
 */
export const FileCitationSchema = z.object({
  type: z.literal('file_citation'),
  index: z.number().int().nonnegative(),
  file_id: z.string(),
  filename: z.string(),
});

export type FileCitation = z.infer<typeof FileCitationSchema>;

/**
 * Search result item from file search
 */
export const FileSearchResultItemSchema = z.object({
  file_id: z.string(),
  filename: z.string().optional(),
  score: z.number().optional(),
  content: z.string().optional(),
});

export type FileSearchResultItem = z.infer<typeof FileSearchResultItemSchema>;

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

export type FileSearchCallItem = z.infer<typeof FileSearchCallItemSchema>;

/**
 * Message content with text and file citations
 */
export const FileSearchMessageContentSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: z.array(FileCitationSchema).optional(),
});

export type FileSearchMessageContent = z.infer<typeof FileSearchMessageContentSchema>;

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

export type FileSearchMessageItem = z.infer<typeof FileSearchMessageItemSchema>;

/**
 * File search response output union
 */
export const FileSearchOutputItemSchema = z.discriminatedUnion('type', [
  FileSearchCallItemSchema,
  FileSearchMessageItemSchema,
]);

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
export const FILE_SEARCH_ERROR_CODES = {
  INVALID_REQUEST: 'file_search_invalid_request',
  API_ERROR: 'file_search_api_error',
  NO_RESULTS: 'file_search_no_results',
  QUOTA_EXCEEDED: 'file_search_quota_exceeded',
  VECTOR_STORE_ERROR: 'file_search_vector_store_error',
  INVALID_VECTOR_STORE: 'file_search_invalid_vector_store',
} as const;

export type FileSearchErrorCode = (typeof FILE_SEARCH_ERROR_CODES)[keyof typeof FILE_SEARCH_ERROR_CODES];
