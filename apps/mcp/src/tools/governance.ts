/**
 * Governance tools for metrics, SLO, and transparency reporting
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpEnv } from '../env.js';
import { createSupabaseClient } from '../supabase.js';

const orgUserSchema = {
    orgId: z.string().uuid().describe('Organization ID'),
    userId: z.string().uuid().describe('User ID'),
};

const sloSnapshotSchema = {
    ...orgUserSchema,
    apiUptimePercent: z.number().min(0).max(100).describe('API uptime percentage'),
    hitlResponseP95Seconds: z.number().min(0).describe('HITL response time P95 in seconds'),
    retrievalLatencyP95Seconds: z.number().min(0).describe('Retrieval latency P95 in seconds'),
    citationPrecisionP95: z.number().min(0).max(100).optional().describe('Citation precision P95'),
    notes: z.string().optional().describe('Optional notes'),
};

const transparencySchema = {
    ...orgUserSchema,
    periodStart: z.string().optional().describe('Report period start (ISO date)'),
    periodEnd: z.string().optional().describe('Report period end (ISO date)'),
};

export function registerGovernanceTools(server: McpServer, env: McpEnv): void {
    /**
     * governance.metrics - Fetch governance metrics overview
     */
    server.registerTool(
        'governance.metrics',
        {
            title: 'Get Governance Metrics',
            description: 'Retrieve governance metrics including citation accuracy, HITL pending count, latency stats, and evaluation pass rates.',
            inputSchema: orgUserSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Loading metrics...',
                'openai/toolInvocation/invoked': 'Metrics loaded',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const { orgId, userId } = args as { orgId: string; userId: string };

            const response = await fetch(`${env.API_BASE_URL}/metrics/governance?orgId=${orgId}`, {
                headers: {
                    'x-user-id': userId,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `Failed to fetch metrics: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const metrics = await response.json() as Record<string, unknown>;

            const overview = metrics.overview as Record<string, unknown> | null;
            const summaryText = overview
                ? `Metrics for ${orgId}:\n- Total runs: ${overview.totalRuns}\n- Avg latency: ${overview.avgLatencyMs}ms\n- Citation ratio: ${overview.allowlistedCitationRatio ?? 'N/A'}\n- HITL pending: ${overview.hitlPending}`
                : 'No metrics available.';

            return {
                content: [{ type: 'text', text: summaryText }],
                structuredContent: {
                    success: true,
                    orgId,
                    ...metrics,
                },
            };
        }
    );

    /**
     * governance.snapshot_perf - Record a performance snapshot
     */
    server.registerTool(
        'governance.snapshot_perf',
        {
            title: 'Record Performance Snapshot',
            description: 'Capture and record a performance snapshot including latency, citation accuracy, and tool metrics. Mirrors pnpm ops:perf-snapshot.',
            inputSchema: {
                ...orgUserSchema,
                windowLabel: z.string().default('rolling-30d').describe('Time window label'),
                notes: z.string().optional().describe('Optional notes'),
            },
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Recording snapshot...',
                'openai/toolInvocation/invoked': 'Snapshot recorded',
                'openai/readOnlyHint': false,
                'openai/destructiveHint': false,
                'openai/openWorldHint': false,
            },
        },
        async (args) => {
            const { orgId, userId, windowLabel = 'rolling-30d', notes } = args as {
                orgId: string;
                userId: string;
                windowLabel?: string;
                notes?: string;
            };

            // First fetch current metrics
            const metricsResponse = await fetch(`${env.API_BASE_URL}/metrics/governance?orgId=${orgId}`, {
                headers: { 'x-user-id': userId },
            });

            if (!metricsResponse.ok) {
                return {
                    content: [{ type: 'text', text: 'Failed to fetch metrics for snapshot' }],
                    structuredContent: { success: false, error: 'Metrics fetch failed' },
                };
            }

            const metrics = await metricsResponse.json() as {
                overview?: {
                    totalRuns?: number;
                    avgLatencyMs?: number;
                    allowlistedCitationRatio?: number | null;
                    hitlMedianResponseMinutes?: number | null;
                    evaluationPassRate?: number | null;
                } | null;
                tools?: Array<{
                    toolName: string;
                    p95LatencyMs: number | null;
                }>;
            };

            const overview = metrics.overview;
            const tools = metrics.tools ?? [];
            const p95 = tools.length > 0
                ? Math.max(...tools.map((t) => t.p95LatencyMs ?? 0))
                : null;

            // Insert into performance_snapshots
            const supabase = createSupabaseClient(env);
            const { error } = await supabase.from('performance_snapshots').insert({
                org_id: orgId,
                window_label: windowLabel,
                total_runs: overview?.totalRuns ?? 0,
                avg_latency_ms: overview?.avgLatencyMs ?? null,
                p95_latency_ms: p95,
                allowlisted_ratio: overview?.allowlistedCitationRatio ?? null,
                hitl_median_minutes: overview?.hitlMedianResponseMinutes ?? null,
                citation_precision: overview?.allowlistedCitationRatio ?? null,
                temporal_validity: overview?.evaluationPassRate ?? null,
                binding_warnings: null,
                notes: notes ?? null,
                recorded_by: userId,
                metadata: { tools },
            });

            if (error) {
                return {
                    content: [{ type: 'text', text: `Snapshot failed: ${error.message}` }],
                    structuredContent: { success: false, error: error.message },
                };
            }

            return {
                content: [{ type: 'text', text: 'Performance snapshot recorded successfully.' }],
                structuredContent: {
                    success: true,
                    orgId,
                    windowLabel,
                    totalRuns: overview?.totalRuns ?? 0,
                    avgLatencyMs: overview?.avgLatencyMs ?? null,
                    p95LatencyMs: p95,
                },
            };
        }
    );

    /**
     * governance.snapshot_slo - Record an SLO snapshot
     */
    server.registerTool(
        'governance.snapshot_slo',
        {
            title: 'Record SLO Snapshot',
            description: 'Record a Service Level Objective snapshot with uptime, latency, and precision metrics.',
            inputSchema: sloSnapshotSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Recording SLO...',
                'openai/toolInvocation/invoked': 'SLO recorded',
                'openai/readOnlyHint': false,
                'openai/destructiveHint': false,
                'openai/openWorldHint': false,
            },
        },
        async (args) => {
            const {
                orgId,
                userId,
                apiUptimePercent,
                hitlResponseP95Seconds,
                retrievalLatencyP95Seconds,
                citationPrecisionP95,
                notes,
            } = args as {
                orgId: string;
                userId: string;
                apiUptimePercent: number;
                hitlResponseP95Seconds: number;
                retrievalLatencyP95Seconds: number;
                citationPrecisionP95?: number;
                notes?: string;
            };

            const response = await fetch(`${env.API_BASE_URL}/metrics/slo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                },
                body: JSON.stringify({
                    orgId,
                    apiUptimePercent,
                    hitlResponseP95Seconds,
                    retrievalLatencyP95Seconds,
                    citationPrecisionP95,
                    notes,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `SLO snapshot failed: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const result = await response.json() as Record<string, unknown>;

            return {
                content: [{ type: 'text', text: 'SLO snapshot recorded successfully.' }],
                structuredContent: {
                    success: true,
                    orgId,
                    ...result,
                },
            };
        }
    );

    /**
     * governance.list_slo - List SLO history
     */
    server.registerTool(
        'governance.list_slo',
        {
            title: 'List SLO History',
            description: 'Retrieve the history of SLO snapshots for an organization.',
            inputSchema: orgUserSchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Loading SLO history...',
                'openai/toolInvocation/invoked': 'History loaded',
                'openai/readOnlyHint': true,
            },
        },
        async (args) => {
            const { orgId, userId } = args as { orgId: string; userId: string };

            const response = await fetch(`${env.API_BASE_URL}/metrics/slo?orgId=${orgId}`, {
                headers: { 'x-user-id': userId },
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `Failed to load SLO history: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const snapshots = await response.json() as Array<Record<string, unknown>>;

            return {
                content: [{ type: 'text', text: `Found ${snapshots.length} SLO snapshots.` }],
                structuredContent: {
                    success: true,
                    orgId,
                    count: snapshots.length,
                    snapshots,
                },
            };
        }
    );

    /**
     * governance.transparency_report - Generate transparency report
     */
    server.registerTool(
        'governance.transparency_report',
        {
            title: 'Generate Transparency Report',
            description: 'Generate a CEPEJ/FRIA compliance transparency report for the specified period.',
            inputSchema: transparencySchema,
            _meta: {
                'openai/outputTemplate': 'ui://widget/governance-dashboard.html',
                'openai/toolInvocation/invoking': 'Generating report...',
                'openai/toolInvocation/invoked': 'Report generated',
                'openai/readOnlyHint': false,
                'openai/destructiveHint': false,
                'openai/openWorldHint': false,
            },
        },
        async (args) => {
            const { orgId, userId, periodStart, periodEnd } = args as {
                orgId: string;
                userId: string;
                periodStart?: string;
                periodEnd?: string;
            };

            const response = await fetch(`${env.API_BASE_URL}/reports/transparency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                },
                body: JSON.stringify({
                    orgId,
                    periodStart,
                    periodEnd,
                    dryRun: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [{ type: 'text', text: `Report generation failed: ${errorText}` }],
                    structuredContent: { success: false, error: errorText },
                };
            }

            const report = await response.json() as Record<string, unknown>;

            return {
                content: [
                    {
                        type: 'text',
                        text: `Transparency report generated for ${orgId} (${periodStart ?? 'start'} to ${periodEnd ?? 'now'}).`,
                    },
                ],
                structuredContent: {
                    success: true,
                    orgId,
                    periodStart,
                    periodEnd,
                    report,
                },
                _meta: {
                    fullReport: report,
                },
            };
        }
    );
}
