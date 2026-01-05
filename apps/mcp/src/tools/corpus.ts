/**
 * Corpus tools for document search and retrieval
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpEnv } from '../env.js';
import { createSupabaseClient } from '../supabase.js';

// Tool input schemas
const corpusSearchSchema = {
    query: z.string().min(1).describe('Search query for legal documents'),
    jurisdiction: z.string().optional().describe('Filter by jurisdiction code (e.g., FR, BE, CH)'),
    limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
};

const documentIdSchema = {
    documentId: z.string().uuid().describe('Unique document identifier'),
};

const resummarizeSchema = {
    documentId: z.string().uuid().describe('Document ID to resummarize'),
    userId: z.string().uuid().describe('User triggering the action'),
    orgId: z.string().uuid().describe('Organization ID'),
};

export function registerCorpusTools(server: McpServer, env: McpEnv): void {
    /**
     * corpus.search - Query document chunks with ranked results
     * Annotations: readOnlyHint = true (no side effects)
     */
    server.registerTool(
        'corpus.search',
        {
            title: 'Search Legal Corpus',
            description: 'Search the legal document corpus for relevant content. Returns ranked results with citations and excerpts from authority documents.',
            inputSchema: corpusSearchSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/corpus-explorer.html',
                'openai/toolInvocation/invoking': 'Searching corpus...',
                'openai/toolInvocation/invoked': 'Search complete',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const supabase = createSupabaseClient(env);
            const { query, jurisdiction, limit = 10 } = args as {
                query: string;
                jurisdiction?: string;
                limit?: number;
            };

            // Build search query using document_chunks with embedding similarity
            let queryBuilder = supabase
                .from('document_chunks')
                .select(`
          id,
          document_id,
          content,
          chunk_index,
          documents!inner(
            id,
            name,
            jurisdiction_code,
            source_url
          )
        `)
                .textSearch('content', query.split(' ').join(' & '))
                .limit(limit);

            if (jurisdiction) {
                queryBuilder = queryBuilder.eq('documents.jurisdiction_code', jurisdiction);
            }

            const { data: chunks, error } = await queryBuilder;

            if (error) {
                return {
                    content: [{ type: 'text', text: `Search failed: ${error.message}` }],
                    structuredContent: { success: false, error: error.message },
                };
            }

            const results = (chunks ?? []).map((chunk: Record<string, unknown>) => {
                const doc = chunk.documents as Record<string, unknown> | null;
                return {
                    id: chunk.id as string,
                    documentId: chunk.document_id as string,
                    documentName: doc?.name ?? 'Unknown',
                    jurisdiction: doc?.jurisdiction_code ?? 'unknown',
                    excerpt: (chunk.content as string)?.slice(0, 300) ?? '',
                    sourceUrl: doc?.source_url ?? null,
                    chunkIndex: chunk.chunk_index as number,
                };
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${results.length} results for "${query}"${jurisdiction ? ` in ${jurisdiction}` : ''}.`,
                    },
                ],
                structuredContent: {
                    success: true,
                    query,
                    jurisdiction,
                    resultCount: results.length,
                    results,
                },
            };
        }
    );

    /**
     * corpus.get_document - Get full document details with summary
     */
    server.registerTool(
        'corpus.get_document',
        {
            title: 'Get Document Details',
            description: 'Retrieve full details of a legal document including summary, key points, and metadata.',
            inputSchema: documentIdSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/corpus-explorer.html',
                'openai/toolInvocation/invoking': 'Loading document...',
                'openai/toolInvocation/invoked': 'Document loaded',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const supabase = createSupabaseClient(env);
            const { documentId } = args as { documentId: string };

            // Fetch document with summary
            const [docResult, summaryResult] = await Promise.all([
                supabase
                    .from('documents')
                    .select('id, name, jurisdiction_code, source_url, created_at, bytes, summary_status, chunk_count')
                    .eq('id', documentId)
                    .single(),
                supabase
                    .from('document_summaries')
                    .select('summary, key_points, generated_at')
                    .eq('document_id', documentId)
                    .single(),
            ]);

            if (docResult.error || !docResult.data) {
                return {
                    content: [{ type: 'text', text: `Document not found: ${docResult.error?.message ?? 'Unknown error'}` }],
                    structuredContent: { success: false, error: 'Document not found' },
                };
            }

            const doc = docResult.data as Record<string, unknown>;
            const summary = summaryResult.data as Record<string, unknown> | null;

            const document = {
                id: doc.id as string,
                name: doc.name as string,
                jurisdiction: doc.jurisdiction_code as string,
                sourceUrl: doc.source_url as string | null,
                createdAt: doc.created_at as string,
                sizeBytes: doc.bytes as number | null,
                summaryStatus: doc.summary_status as string,
                chunkCount: doc.chunk_count as number,
                summary: summary?.summary as string | null,
                keyPoints: summary?.key_points as string[] | null,
                summaryGeneratedAt: summary?.generated_at as string | null,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: `Document: ${document.name} (${document.jurisdiction})\n${document.summary ?? 'No summary available.'}`,
                    },
                ],
                structuredContent: {
                    success: true,
                    document,
                },
            };
        }
    );

    /**
     * corpus.get_chunks - Get document chunks for review
     */
    server.registerTool(
        'corpus.get_chunks',
        {
            title: 'Get Document Chunks',
            description: 'Retrieve text chunks from a document for detailed review. Useful for "show your work" displays.',
            inputSchema: {
                ...documentIdSchema,
                offset: z.number().min(0).default(0).describe('Pagination offset'),
                limit: z.number().min(1).max(20).default(10).describe('Number of chunks to retrieve'),
            },
            _meta: {
                'openai/outputTemplate': 'ui://widget/corpus-explorer.html',
                'openai/toolInvocation/invoking': 'Loading chunks...',
                'openai/toolInvocation/invoked': 'Chunks loaded',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const supabase = createSupabaseClient(env);
            const { documentId, offset = 0, limit = 10 } = args as {
                documentId: string;
                offset?: number;
                limit?: number;
            };

            const { data: chunks, error, count } = await supabase
                .from('document_chunks')
                .select('id, chunk_index, content, created_at', { count: 'exact' })
                .eq('document_id', documentId)
                .order('chunk_index', { ascending: true })
                .range(offset, offset + limit - 1);

            if (error) {
                return {
                    content: [{ type: 'text', text: `Failed to load chunks: ${error.message}` }],
                    structuredContent: { success: false, error: error.message },
                };
            }

            const chunkList = (chunks ?? []).map((chunk: Record<string, unknown>) => ({
                id: chunk.id as string,
                index: chunk.chunk_index as number,
                content: chunk.content as string,
                createdAt: chunk.created_at as string,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: `Showing chunks ${offset + 1}-${offset + chunkList.length} of ${count ?? 0} total.`,
                    },
                ],
                structuredContent: {
                    success: true,
                    documentId,
                    totalChunks: count,
                    offset,
                    chunks: chunkList,
                },
            };
        }
    );

    /**
     * corpus.resummarize - Trigger document resummarization
     * Annotations: readOnlyHint = false, destructiveHint = false, openWorldHint = false
     */
    server.registerTool(
        'corpus.resummarize',
        {
            title: 'Resummarize Document',
            description: 'Trigger re-generation of document summary and key points. This calls the summarization pipeline with OpenAI.',
            inputSchema: resummarizeSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/corpus-explorer.html',
                'openai/toolInvocation/invoking': 'Starting resummarization...',
                'openai/toolInvocation/invoked': 'Resummarization triggered',
                'openai/readOnlyHint': false,
                'openai/destructiveHint': false,
                'openai/openWorldHint': false,
            },
        },
        async (args) => {
            const { documentId, userId, orgId } = args as {
                documentId: string;
                userId: string;
                orgId: string;
            };

            // Call existing resummarize API endpoint
            const response = await fetch(`${env.API_BASE_URL}/corpus/${documentId}/resummarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-org-id': orgId,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `Resummarization failed: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const result = await response.json() as Record<string, unknown>;

            return {
                content: [
                    {
                        type: 'text',
                        text: `Resummarization triggered for document ${documentId}. Status: ${result.status ?? 'pending'}`,
                    },
                ],
                structuredContent: {
                    success: true,
                    documentId,
                    ...result,
                },
            };
        }
    );
}
