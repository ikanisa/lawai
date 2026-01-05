/**
 * Crawler tools for authority ingestion
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpEnv } from '../env.js';

const runAuthoritiesSchema = {
    orgId: z.string().uuid().describe('Organization ID'),
    vectorStoreId: z.string().optional().describe('OpenAI Vector Store ID (uses default if not provided)'),
    embeddingModel: z.string().default('text-embedding-3-large').describe('Embedding model to use'),
    summariserModel: z.string().default('gpt-4o-mini').describe('Summarization model'),
    maxSummaryChars: z.number().default(12000).describe('Maximum characters for summaries'),
};

export function registerCrawlerTools(server: McpServer, env: McpEnv): void {
    /**
     * crawler.run_authorities - Invoke crawl-authorities Edge Function
     * Annotations: readOnlyHint = false, openWorldHint = true (external API calls)
     */
    server.registerTool(
        'crawler.run_authorities',
        {
            title: 'Run Authority Crawler',
            description: 'Invoke the crawl-authorities Supabase Edge Function to fetch and process legal authority documents. This connects to external authority portals (Légifrance, Justel, etc.) and calls OpenAI for summarization.',
            inputSchema: runAuthoritiesSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Starting authority crawler...',
                'openai/toolInvocation/invoked': 'Crawler invoked',
                'openai/readOnlyHint': false,
                'openai/openWorldHint': true,
                'openai/destructiveHint': false,
            },
        },
        async (args) => {
            const {
                orgId,
                vectorStoreId,
                embeddingModel = 'text-embedding-3-large',
                summariserModel = 'gpt-4o-mini',
                maxSummaryChars = 12000,
            } = args as {
                orgId: string;
                vectorStoreId?: string;
                embeddingModel?: string;
                summariserModel?: string;
                maxSummaryChars?: number;
            };

            if (!env.SUPABASE_EDGE_URL) {
                return {
                    content: [{ type: 'text', text: 'Crawler unavailable: SUPABASE_EDGE_URL not configured' }],
                    structuredContent: { success: false, error: 'Edge Function URL not configured' },
                };
            }

            if (!env.OPENAI_API_KEY) {
                return {
                    content: [{ type: 'text', text: 'Crawler unavailable: OPENAI_API_KEY not configured' }],
                    structuredContent: { success: false, error: 'OpenAI API key not configured' },
                };
            }

            const payload = {
                supabaseUrl: env.SUPABASE_URL,
                supabaseServiceRole: env.SUPABASE_SERVICE_ROLE_KEY,
                orgId,
                openaiApiKey: env.OPENAI_API_KEY,
                vectorStoreId: vectorStoreId ?? env.OPENAI_VECTOR_STORE_AUTHORITIES_ID,
                embeddingModel,
                summariserModel,
                maxSummaryChars,
            };

            const response = await fetch(`${env.SUPABASE_EDGE_URL}/crawl-authorities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `Crawler invocation failed: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const result = await response.json() as Record<string, unknown>;

            return {
                content: [
                    {
                        type: 'text',
                        text: `Authority crawler invoked successfully. Status: ${result.status ?? 'ok'}`,
                    },
                ],
                structuredContent: {
                    success: true,
                    orgId,
                    crawlerId: result.function ?? 'crawl-authorities',
                    invokedAt: result.invokedAt ?? new Date().toISOString(),
                    ...result,
                },
            };
        }
    );
}
