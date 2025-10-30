/**
 * Web Search Types for OpenAI Responses API
 * Based on OpenAI documentation for web search functionality
 */
import { z } from 'zod';
/**
 * User location for geographically-refined search results
 */
export const UserLocationSchema = z.object({
    type: z.literal('approximate'),
    country: z.string().length(2).optional(), // ISO 3166-1 alpha-2 country code
    city: z.string().optional(),
    region: z.string().optional(),
    timezone: z.string().optional(), // IANA timezone
});
/**
 * Web search tool configuration
 */
export const WebSearchToolSchema = z.object({
    type: z.literal('web_search'),
    filters: z
        .object({
        allowed_domains: z.array(z.string()).max(20).optional(),
    })
        .optional(),
    user_location: UserLocationSchema.optional(),
    external_web_access: z.boolean().optional(), // Default: true. Set false for cache-only mode
});
/**
 * Web search action types
 */
export const WebSearchActionTypeSchema = z.enum(['search', 'open_page', 'find_in_page']);
/**
 * Source information from web search
 */
export const WebSearchSourceSchema = z.object({
    url: z.string().url(),
    title: z.string().optional(),
    type: z.string().optional(), // e.g., 'oai-sports', 'oai-weather', 'oai-finance'
});
/**
 * Web search action details
 */
export const WebSearchActionSchema = z.object({
    type: WebSearchActionTypeSchema,
    query: z.string().optional(),
    domains: z.array(z.string()).optional(),
    sources: z.array(WebSearchSourceSchema).optional(),
});
/**
 * URL citation annotation
 */
export const URLCitationSchema = z.object({
    type: z.literal('url_citation'),
    start_index: z.number().int().nonnegative(),
    end_index: z.number().int().nonnegative(),
    url: z.string().url(),
    title: z.string().optional(),
});
/**
 * Web search call output item
 */
export const WebSearchCallItemSchema = z.object({
    type: z.literal('web_search_call'),
    id: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed']),
    action: WebSearchActionSchema.optional(),
});
/**
 * Message content with text and annotations
 */
export const MessageContentSchema = z.object({
    type: z.literal('output_text'),
    text: z.string(),
    annotations: z.array(URLCitationSchema).optional(),
});
/**
 * Message output item
 */
export const MessageItemSchema = z.object({
    id: z.string(),
    type: z.literal('message'),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed']),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.array(MessageContentSchema),
});
/**
 * Web search response output union
 */
export const WebSearchOutputItemSchema = z.discriminatedUnion('type', [
    WebSearchCallItemSchema,
    MessageItemSchema,
]);
/**
 * Web search error codes
 */
export const WEB_SEARCH_ERROR_CODES = {
    INVALID_REQUEST: 'web_search_invalid_request',
    API_ERROR: 'web_search_api_error',
    NO_RESULTS: 'web_search_no_results',
    QUOTA_EXCEEDED: 'web_search_quota_exceeded',
    DOMAIN_FILTER_ERROR: 'web_search_domain_filter_error',
};
