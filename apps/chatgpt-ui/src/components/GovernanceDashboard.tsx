import React from 'react';
import { getToolOutput, getToolText } from '../lib/openai-bridge';
import '../index.css';

interface MetricsOverview {
    orgId: string;
    totalRuns: number;
    avgLatencyMs: number;
    allowlistedCitationRatio: number | null;
    hitlPending: number;
    hitlMedianResponseMinutes: number | null;
    evaluationPassRate: number | null;
}

interface SloSnapshot {
    id: string;
    created_at?: string;
    recorded_at?: string;
    api_uptime_percent: number;
    hitl_response_p95_seconds: number;
    retrieval_latency_p95_seconds: number;
    citation_precision_p95?: number;
    notes?: string;
}

interface GovernanceData {
    success: boolean;
    overview?: MetricsOverview;
    snapshots?: SloSnapshot[];
    error?: string;
}

function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '-';
    return `${ms.toFixed(0)}ms`;
}

export function GovernanceDashboard(): React.ReactElement {
    const data = getToolOutput<GovernanceData>();
    const textMessage = getToolText();

    if (!data || data.error) {
        return (
            <div className="p-4">
                <h1 className="title mb-4">Governance Dashboard</h1>
                <div className="empty-state">
                    {data?.error || 'No governance data available.'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h1 className="title mb-4">Governance Dashboard</h1>

            {/* Metrics Overview */}
            {data.overview && (
                <div className="grid grid-auto gap-3 mb-4">
                    <div className="metric">
                        <div className="metric-value">{data.overview.totalRuns}</div>
                        <div className="metric-label">Total Runs</div>
                    </div>
                    <div className="metric">
                        <div className="metric-value">{formatLatency(data.overview.avgLatencyMs)}</div>
                        <div className="metric-label">Avg Latency</div>
                    </div>
                    <div className="metric">
                        <div className="metric-value">{formatPercent(data.overview.allowlistedCitationRatio)}</div>
                        <div className="metric-label">Citation Accuracy</div>
                    </div>
                    <div className="metric">
                        <div className="metric-value">{data.overview.hitlPending}</div>
                        <div className="metric-label">HITL Pending</div>
                    </div>
                    {data.overview.evaluationPassRate !== null && (
                        <div className="metric">
                            <div className="metric-value">{formatPercent(data.overview.evaluationPassRate)}</div>
                            <div className="metric-label">Eval Pass Rate</div>
                        </div>
                    )}
                </div>
            )}

            {/* SLO History */}
            {data.snapshots && data.snapshots.length > 0 && (
                <div className="mb-4">
                    <h2 className="subtitle mb-3">SLO History</h2>
                    <ul className="list">
                        {data.snapshots.slice(0, 5).map((snapshot, idx) => (
                            <li
                                key={snapshot.id || idx}
                                className="list-item"
                                style={{ borderLeftColor: 'var(--color-primary)', borderLeftWidth: '3px' }}
                            >
                                <div className="flex justify-between">
                                    <span className="caption">
                                        {snapshot.created_at || snapshot.recorded_at || 'Unknown date'}
                                    </span>
                                    <span className="badge badge-success">
                                        {snapshot.api_uptime_percent}% uptime
                                    </span>
                                </div>
                                <div className="caption mt-2">
                                    HITL P95: {snapshot.hitl_response_p95_seconds}s |
                                    Retrieval P95: {snapshot.retrieval_latency_p95_seconds}s
                                    {snapshot.notes && ` | ${snapshot.notes}`}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Success message fallback */}
            {textMessage && !data.overview && !data.snapshots && (
                <div className="card">
                    <span style={{ color: 'var(--color-success)' }}>✓</span> {textMessage}
                </div>
            )}
        </div>
    );
}

export default GovernanceDashboard;
