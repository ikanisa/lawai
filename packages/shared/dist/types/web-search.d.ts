/**
 * Web Search Types for OpenAI Responses API
 * Based on OpenAI documentation for web search functionality
 */
import { z } from 'zod';
/**
 * User location for geographically-refined search results
 */
export declare const UserLocationSchema: z.ZodObject<{
    type: z.ZodLiteral<"approximate">;
    country: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "approximate";
    country?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    timezone?: string | undefined;
}, {
    type: "approximate";
    country?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    timezone?: string | undefined;
}>;
export type UserLocation = z.infer<typeof UserLocationSchema>;
/**
 * Web search tool configuration
 */
export declare const WebSearchToolSchema: z.ZodObject<{
    type: z.ZodLiteral<"web_search">;
    filters: z.ZodOptional<z.ZodObject<{
        allowed_domains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allowed_domains?: string[] | undefined;
    }, {
        allowed_domains?: string[] | undefined;
    }>>;
    user_location: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"approximate">;
        country: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "approximate";
        country?: string | undefined;
        city?: string | undefined;
        region?: string | undefined;
        timezone?: string | undefined;
    }, {
        type: "approximate";
        country?: string | undefined;
        city?: string | undefined;
        region?: string | undefined;
        timezone?: string | undefined;
    }>>;
    external_web_access: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "web_search";
    filters?: {
        allowed_domains?: string[] | undefined;
    } | undefined;
    user_location?: {
        type: "approximate";
        country?: string | undefined;
        city?: string | undefined;
        region?: string | undefined;
        timezone?: string | undefined;
    } | undefined;
    external_web_access?: boolean | undefined;
}, {
    type: "web_search";
    filters?: {
        allowed_domains?: string[] | undefined;
    } | undefined;
    user_location?: {
        type: "approximate";
        country?: string | undefined;
        city?: string | undefined;
        region?: string | undefined;
        timezone?: string | undefined;
    } | undefined;
    external_web_access?: boolean | undefined;
}>;
export type WebSearchTool = z.infer<typeof WebSearchToolSchema>;
/**
 * Web search action types
 */
export declare const WebSearchActionTypeSchema: z.ZodEnum<["search", "open_page", "find_in_page"]>;
export type WebSearchActionType = z.infer<typeof WebSearchActionTypeSchema>;
/**
 * Source information from web search
 */
export declare const WebSearchSourceSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    type?: string | undefined;
    title?: string | undefined;
}, {
    url: string;
    type?: string | undefined;
    title?: string | undefined;
}>;
export type WebSearchSource = z.infer<typeof WebSearchSourceSchema>;
/**
 * Web search action details
 */
export declare const WebSearchActionSchema: z.ZodObject<{
    type: z.ZodEnum<["search", "open_page", "find_in_page"]>;
    query: z.ZodOptional<z.ZodString>;
    domains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        type?: string | undefined;
        title?: string | undefined;
    }, {
        url: string;
        type?: string | undefined;
        title?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "search" | "open_page" | "find_in_page";
    query?: string | undefined;
    sources?: {
        url: string;
        type?: string | undefined;
        title?: string | undefined;
    }[] | undefined;
    domains?: string[] | undefined;
}, {
    type: "search" | "open_page" | "find_in_page";
    query?: string | undefined;
    sources?: {
        url: string;
        type?: string | undefined;
        title?: string | undefined;
    }[] | undefined;
    domains?: string[] | undefined;
}>;
export type WebSearchAction = z.infer<typeof WebSearchActionSchema>;
/**
 * URL citation annotation
 */
export declare const URLCitationSchema: z.ZodObject<{
    type: z.ZodLiteral<"url_citation">;
    start_index: z.ZodNumber;
    end_index: z.ZodNumber;
    url: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "url_citation";
    url: string;
    start_index: number;
    end_index: number;
    title?: string | undefined;
}, {
    type: "url_citation";
    url: string;
    start_index: number;
    end_index: number;
    title?: string | undefined;
}>;
export type URLCitation = z.infer<typeof URLCitationSchema>;
/**
 * Web search call output item
 */
export declare const WebSearchCallItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"web_search_call">;
    id: z.ZodString;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    action: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["search", "open_page", "find_in_page"]>;
        query: z.ZodOptional<z.ZodString>;
        domains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
            type: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }, {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    }, {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "web_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    action?: {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    } | undefined;
}, {
    type: "web_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    action?: {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    } | undefined;
}>;
export type WebSearchCallItem = z.infer<typeof WebSearchCallItemSchema>;
/**
 * Message content with text and annotations
 */
export declare const MessageContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"output_text">;
    text: z.ZodString;
    annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"url_citation">;
        start_index: z.ZodNumber;
        end_index: z.ZodNumber;
        url: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "url_citation";
        url: string;
        start_index: number;
        end_index: number;
        title?: string | undefined;
    }, {
        type: "url_citation";
        url: string;
        start_index: number;
        end_index: number;
        title?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    text: string;
    type: "output_text";
    annotations?: {
        type: "url_citation";
        url: string;
        start_index: number;
        end_index: number;
        title?: string | undefined;
    }[] | undefined;
}, {
    text: string;
    type: "output_text";
    annotations?: {
        type: "url_citation";
        url: string;
        start_index: number;
        end_index: number;
        title?: string | undefined;
    }[] | undefined;
}>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
/**
 * Message output item
 */
export declare const MessageItemSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"message">;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"output_text">;
        text: z.ZodString;
        annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"url_citation">;
            start_index: z.ZodNumber;
            end_index: z.ZodNumber;
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }, {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }, {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    status: "queued" | "completed" | "failed" | "in_progress";
    content: {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }[];
    id: string;
    role: "user" | "assistant" | "system";
}, {
    type: "message";
    status: "queued" | "completed" | "failed" | "in_progress";
    content: {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }[];
    id: string;
    role: "user" | "assistant" | "system";
}>;
export type MessageItem = z.infer<typeof MessageItemSchema>;
/**
 * Web search response output union
 */
export declare const WebSearchOutputItemSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"web_search_call">;
    id: z.ZodString;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    action: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["search", "open_page", "find_in_page"]>;
        query: z.ZodOptional<z.ZodString>;
        domains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
            type: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }, {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    }, {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "web_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    action?: {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    } | undefined;
}, {
    type: "web_search_call";
    status: "queued" | "completed" | "failed" | "in_progress";
    id: string;
    action?: {
        type: "search" | "open_page" | "find_in_page";
        query?: string | undefined;
        sources?: {
            url: string;
            type?: string | undefined;
            title?: string | undefined;
        }[] | undefined;
        domains?: string[] | undefined;
    } | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"message">;
    status: z.ZodEnum<["queued", "in_progress", "completed", "failed"]>;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"output_text">;
        text: z.ZodString;
        annotations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"url_citation">;
            start_index: z.ZodNumber;
            end_index: z.ZodNumber;
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }, {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }, {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    status: "queued" | "completed" | "failed" | "in_progress";
    content: {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }[];
    id: string;
    role: "user" | "assistant" | "system";
}, {
    type: "message";
    status: "queued" | "completed" | "failed" | "in_progress";
    content: {
        text: string;
        type: "output_text";
        annotations?: {
            type: "url_citation";
            url: string;
            start_index: number;
            end_index: number;
            title?: string | undefined;
        }[] | undefined;
    }[];
    id: string;
    role: "user" | "assistant" | "system";
}>]>;
export type WebSearchOutputItem = z.infer<typeof WebSearchOutputItemSchema>;
/**
 * Web search request parameters
 */
export interface WebSearchRequest {
    query: string;
    model?: string;
    allowedDomains?: string[];
    userLocation?: UserLocation;
    externalWebAccess?: boolean;
    maxOutputTokens?: number;
}
/**
 * Processed web search result
 */
export interface WebSearchResult {
    text: string;
    citations: URLCitation[];
    sources: WebSearchSource[];
    searchCallId?: string;
    action?: WebSearchAction;
}
/**
 * Web search error codes
 */
export declare const WEB_SEARCH_ERROR_CODES: {
    readonly INVALID_REQUEST: "web_search_invalid_request";
    readonly API_ERROR: "web_search_api_error";
    readonly NO_RESULTS: "web_search_no_results";
    readonly QUOTA_EXCEEDED: "web_search_quota_exceeded";
    readonly DOMAIN_FILTER_ERROR: "web_search_domain_filter_error";
};
export type WebSearchErrorCode = (typeof WEB_SEARCH_ERROR_CODES)[keyof typeof WEB_SEARCH_ERROR_CODES];
//# sourceMappingURL=web-search.d.ts.map