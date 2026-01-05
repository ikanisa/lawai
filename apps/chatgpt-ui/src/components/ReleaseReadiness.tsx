import React from 'react';
import { getToolOutput, getToolText } from '../lib/openai-bridge';
import '../index.css';

interface Section {
    section: string;
    total: number;
    satisfied: number;
    pending: number;
    isSatisfied: boolean;
}

interface Signoff {
    releaseTag: string;
    decision: string;
    decidedAt: string;
    evidenceTotal: number;
}

interface ReleaseData {
    success: boolean;
    ready: boolean;
    missingSections: string[];
    friaSatisfied: boolean;
    hasGoDecision: boolean;
    sections: Section[];
    signoffs: Signoff[];
    friaValidatedCount: number;
    friaTotal: number;
    releaseTag?: string | null;
    error?: string;
}

export function ReleaseReadiness(): React.ReactElement {
    const data = getToolOutput<ReleaseData>();
    const textMessage = getToolText();

    if (!data || data.error) {
        return (
            <div className="p-4">
                <h1 className="title mb-4">Release Readiness</h1>
                <div className="empty-state">
                    {data?.error || 'No release readiness data available.'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Header with status */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="title">Release Readiness</h1>
                <span className={data.ready ? 'status-ready' : 'status-not-ready'}>
                    {data.ready ? '✓ Ready' : '✗ Not Ready'}
                </span>
            </div>

            {/* Section cards */}
            {data.sections && (
                <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                    {data.sections.map((section) => (
                        <div
                            key={section.section}
                            className="card"
                            style={{
                                textAlign: 'center',
                                background: section.isSatisfied
                                    ? 'var(--color-success-bg)'
                                    : section.total > 0
                                        ? 'var(--color-error-bg)'
                                        : 'var(--color-bg-secondary)',
                            }}
                        >
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{section.section}</div>
                            <div className="caption">{section.satisfied}/{section.total}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info rows */}
            <div className="card">
                <div className="flex justify-between mb-2">
                    <span className="text-muted">FRIA Validated</span>
                    <span style={{ fontWeight: 500 }}>
                        {data.friaValidatedCount}/{data.friaTotal}
                    </span>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-muted">FRIA Status</span>
                    <span style={{ fontWeight: 500, color: data.friaSatisfied ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {data.friaSatisfied ? '✓ Satisfied' : '✗ Missing'}
                    </span>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-muted">GO Decision</span>
                    <span style={{ fontWeight: 500 }}>
                        {data.hasGoDecision ? '✓ Recorded' : '○ Pending'}
                    </span>
                </div>
                {data.missingSections && data.missingSections.length > 0 && (
                    <div className="flex justify-between">
                        <span className="text-muted">Missing Sections</span>
                        <span style={{ fontWeight: 500, color: 'var(--color-error)' }}>
                            {data.missingSections.join(', ')}
                        </span>
                    </div>
                )}
            </div>

            {/* Signoffs */}
            {data.signoffs && data.signoffs.length > 0 && (
                <div className="mt-4">
                    <h2 className="subtitle mb-3">Recent Signoffs</h2>
                    <ul className="list">
                        {data.signoffs.slice(0, 3).map((signoff, idx) => (
                            <li key={idx} className="list-item">
                                <div className="flex justify-between">
                                    <span className="badge">{signoff.releaseTag}</span>
                                    <span className={signoff.decision === 'go' ? 'badge badge-success' : 'badge badge-error'}>
                                        {signoff.decision.toUpperCase()}
                                    </span>
                                </div>
                                <div className="caption mt-2">
                                    {signoff.decidedAt} | {signoff.evidenceTotal} evidence items
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ReleaseReadiness;
