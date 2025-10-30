/**
 * Web Search Service
 * 
 * Provides web search functionality using OpenAI's Responses API.
 * Supports domain filtering, user location, and citation extraction.
 */

import { getOpenAI, logOpenAIDebug } from '../openai.js';
import {
  type WebSearchRequest,
  type WebSearchResult,
  type WebSearchCallItem,
  type MessageItem,
  type WebSearchOutputItem,
  type URLCitation,
  type WebSearchSource,
  WEB_SEARCH_ERROR_CODES,
} from '@avocat-ai/shared';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_OUTPUT_TOKENS = 16000;

type Logger = {
  error: (data: Record<string, unknown>, message: string) => void;
  warn?: (data: Record<string, unknown>, message: string) => void;
  info?: (data: Record<string, unknown>, message: string) => void;
};

/**
 * Extract web search call items from response output
 */
function extractWebSearchCalls(output: unknown[]): WebSearchCallItem[] {
  const calls: WebSearchCallItem[] = [];
  
  for (const item of output) {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'web_search_call'
    ) {
      calls.push(item as WebSearchCallItem);
    }
  }
  
  return calls;
}

/**
 * Extract message items from response output
 */
function extractMessages(output: unknown[]): MessageItem[] {
  const messages: MessageItem[] = [];
  
  for (const item of output) {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'message'
    ) {
      messages.push(item as MessageItem);
    }
  }
  
  return messages;
}

/**
 * Extract citations from message content
 */
function extractCitations(message: MessageItem): URLCitation[] {
  const citations: URLCitation[] = [];
  
  for (const content of message.content) {
    if (content.annotations) {
      for (const annotation of content.annotations) {
        if (annotation.type === 'url_citation') {
          citations.push(annotation);
        }
      }
    }
  }
  
  return citations;
}

/**
 * Extract sources from web search action
 */
function extractSources(calls: WebSearchCallItem[]): WebSearchSource[] {
  const sources: WebSearchSource[] = [];
  
  for (const call of calls) {
    if (call.action?.sources) {
      sources.push(...call.action.sources);
    }
  }
  
  return sources;
}

/**
 * Perform a web search using OpenAI's Responses API
 */
export async function performWebSearch(
  request: WebSearchRequest,
  logger?: Logger,
): Promise<WebSearchResult> {
  const {
    query,
    model = DEFAULT_MODEL,
    allowedDomains,
    userLocation,
    externalWebAccess = true,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  } = request;

  if (!query || query.trim().length === 0) {
    throw new Error(WEB_SEARCH_ERROR_CODES.INVALID_REQUEST);
  }

  const openai = getOpenAI();

  // Build web search tool configuration
  const webSearchTool: Record<string, unknown> = {
    type: 'web_search',
    external_web_access: externalWebAccess,
  };

  // Add domain filtering if provided
  if (allowedDomains && allowedDomains.length > 0) {
    if (allowedDomains.length > 20) {
      logger?.warn?.(
        { domainCount: allowedDomains.length },
        'web_search_domain_limit_exceeded',
      );
      // Truncate to 20 domains per API limit
      allowedDomains = allowedDomains.slice(0, 20);
    }
    webSearchTool.filters = { allowed_domains: allowedDomains };
  }

  // Add user location if provided
  if (userLocation) {
    webSearchTool.user_location = userLocation;
  }

  try {
    logger?.info?.(
      {
        query,
        model,
        hasDomainFilter: !!allowedDomains,
        hasUserLocation: !!userLocation,
        externalWebAccess,
      },
      'web_search_request',
    );

    // Make the API request
    const response = await openai.responses.create({
      model,
      tools: [webSearchTool],
      tool_choice: { type: 'tool', function: { name: 'web_search' } },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: query,
            },
          ],
        },
      ],
      max_output_tokens: maxOutputTokens,
      // Request sources to be included in the response
      include: ['web_search_call.action.sources'],
    });

    // Extract output items
    const output = (response.output || []) as unknown[];
    const webSearchCalls = extractWebSearchCalls(output);
    const messages = extractMessages(output);

    // Extract text from assistant message
    let text = '';
    const allCitations: URLCitation[] = [];
    
    for (const message of messages) {
      if (message.role === 'assistant') {
        for (const content of message.content) {
          if (content.type === 'output_text') {
            text += content.text;
          }
        }
        allCitations.push(...extractCitations(message));
      }
    }

    // Extract sources from web search calls
    const sources = extractSources(webSearchCalls);

    // Get primary web search call info
    const primaryCall = webSearchCalls[0];

    const result: WebSearchResult = {
      text: text.trim(),
      citations: allCitations,
      sources,
      searchCallId: primaryCall?.id,
      action: primaryCall?.action,
    };

    logger?.info?.(
      {
        textLength: result.text.length,
        citationCount: result.citations.length,
        sourceCount: result.sources.length,
        searchCallId: result.searchCallId,
      },
      'web_search_success',
    );

    return result;
  } catch (error) {
    await logOpenAIDebug('web_search', error, logger);

    const errorCode =
      error instanceof Error && error.message.includes('quota')
        ? WEB_SEARCH_ERROR_CODES.QUOTA_EXCEEDED
        : WEB_SEARCH_ERROR_CODES.API_ERROR;

    logger?.error?.(
      {
        error: error instanceof Error ? error.message : String(error),
        query,
      },
      errorCode,
    );

    throw error;
  }
}

/**
 * Validate allowed domains list
 */
export function validateAllowedDomains(domains: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const domain of domains) {
    const trimmed = domain.trim().toLowerCase();
    
    // Remove http/https prefix if present
    const cleaned = trimmed.replace(/^https?:\/\//, '');
    
    // Basic hostname validation
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(cleaned)) {
      valid.push(cleaned);
    } else {
      invalid.push(domain);
    }
  }

  return { valid, invalid };
}
