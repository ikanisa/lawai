/**
 * File Search Service
 * 
 * Provides file search functionality using OpenAI's Responses API.
 * Supports vector stores, metadata filtering, and result customization.
 */

import { getOpenAI, logOpenAIDebug } from '../openai.js';
import {
  type FileSearchRequest,
  type FileSearchResult,
  type FileSearchCallItem,
  type FileSearchMessageItem,
  type FileCitation,
  FILE_SEARCH_ERROR_CODES,
} from '@avocat-ai/shared';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_OUTPUT_TOKENS = 16000;

type Logger = {
  error: (data: Record<string, unknown> | string, message?: string) => void;
  warn?: (data: Record<string, unknown> | string, message?: string) => void;
  info?: (data: Record<string, unknown> | string, message?: string) => void;
};

/**
 * Extract file search call items from response output
 */
function extractFileSearchCalls(output: unknown[]): FileSearchCallItem[] {
  const calls: FileSearchCallItem[] = [];
  
  for (const item of output) {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'file_search_call'
    ) {
      calls.push(item as FileSearchCallItem);
    }
  }
  
  return calls;
}

/**
 * Extract message items from response output
 */
function extractMessages(output: unknown[]): FileSearchMessageItem[] {
  const messages: FileSearchMessageItem[] = [];
  
  for (const item of output) {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'message'
    ) {
      messages.push(item as FileSearchMessageItem);
    }
  }
  
  return messages;
}

/**
 * Extract file citations from message content
 */
function extractFileCitations(message: FileSearchMessageItem): FileCitation[] {
  const citations: FileCitation[] = [];
  
  for (const content of message.content) {
    if (content.annotations) {
      for (const annotation of content.annotations) {
        if (annotation.type === 'file_citation') {
          citations.push(annotation);
        }
      }
    }
  }
  
  return citations;
}

/**
 * Perform a file search using OpenAI's Responses API
 */
export async function performFileSearch(
  request: FileSearchRequest,
  logger?: Logger,
): Promise<FileSearchResult> {
  const {
    query,
    vectorStoreIds,
    model = DEFAULT_MODEL,
    maxNumResults,
    filters,
    includeSearchResults = false,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  } = request;

  if (!query || query.trim().length === 0) {
    throw new Error(FILE_SEARCH_ERROR_CODES.INVALID_REQUEST);
  }

  if (!vectorStoreIds || vectorStoreIds.length === 0) {
    throw new Error(FILE_SEARCH_ERROR_CODES.INVALID_VECTOR_STORE);
  }

  const openai = getOpenAI();

  // Build file search tool configuration
  const fileSearchTool: Record<string, unknown> = {
    type: 'file_search',
    vector_store_ids: vectorStoreIds,
  };

  // Add max_num_results if provided
  if (maxNumResults !== undefined) {
    fileSearchTool.max_num_results = maxNumResults;
  }

  // Add filters if provided
  if (filters) {
    fileSearchTool.filters = filters;
  }

  try {
    logger?.info?.(
      {
        query,
        model,
        vectorStoreCount: vectorStoreIds.length,
        maxNumResults,
        hasFilters: !!filters,
        includeSearchResults,
      },
      'file_search_request',
    );

    // Build include parameter
    const include: string[] = [];
    if (includeSearchResults) {
      include.push('file_search_call.results');
    }

    // Make the API request
    const response = await openai.responses.create({
      model,
      tools: [fileSearchTool],
      tool_choice: { type: 'tool', function: { name: 'file_search' } },
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
      ...(include.length > 0 && { include }),
    });

    // Extract output items
    const output = (response.output || []) as unknown[];
    const fileSearchCalls = extractFileSearchCalls(output);
    const messages = extractMessages(output);

    // Extract text from assistant message
    let text = '';
    const allCitations: FileCitation[] = [];
    
    for (const message of messages) {
      if (message.role === 'assistant') {
        for (const content of message.content) {
          if (content.type === 'output_text') {
            text += content.text;
          }
        }
        allCitations.push(...extractFileCitations(message));
      }
    }

    // Get primary file search call info
    const primaryCall = fileSearchCalls[0];

    const result: FileSearchResult = {
      text: text.trim(),
      citations: allCitations,
      searchCallId: primaryCall?.id,
    };

    // Include search results if requested
    if (includeSearchResults && primaryCall?.search_results) {
      result.searchResults = primaryCall.search_results;
    }

    logger?.info?.(
      {
        textLength: result.text.length,
        citationCount: result.citations.length,
        searchResultCount: result.searchResults?.length || 0,
        searchCallId: result.searchCallId,
      },
      'file_search_success',
    );

    return result;
  } catch (error) {
    await logOpenAIDebug('file_search', error, logger);

    const errorCode =
      error instanceof Error && error.message.includes('quota')
        ? FILE_SEARCH_ERROR_CODES.QUOTA_EXCEEDED
        : error instanceof Error && error.message.includes('vector_store')
        ? FILE_SEARCH_ERROR_CODES.VECTOR_STORE_ERROR
        : FILE_SEARCH_ERROR_CODES.API_ERROR;

    logger?.error?.(
      {
        error: error instanceof Error ? error.message : String(error),
        query,
        vectorStoreIds,
      },
      errorCode,
    );

    throw error;
  }
}

/**
 * Validate vector store IDs
 */
export function validateVectorStoreIds(ids: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const id of ids) {
    const trimmed = id.trim();
    
    // Vector store IDs should start with 'vs_' and have alphanumeric characters
    if (/^vs_[a-zA-Z0-9]+$/.test(trimmed)) {
      valid.push(trimmed);
    } else {
      invalid.push(id);
    }
  }

  return { valid, invalid };
}
