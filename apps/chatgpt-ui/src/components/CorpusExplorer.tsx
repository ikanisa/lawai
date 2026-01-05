import React from 'react';
import { getToolOutput, getToolText } from '../lib/openai-bridge';
import '../index.css';

interface SearchResult {
    id: string;
    documentId: string;
    documentName: string;
    jurisdiction: string;
    excerpt: string;
    sourceUrl: string | null;
    chunkIndex: number;
}

interface Document {
    id: string;
    name: string;
    jurisdiction: string;
    sourceUrl: string | null;
    summaryStatus: string;
    chunkCount: number;
    summary: string | null;
    keyPoints: string[] | null;
}

interface CorpusData {
    success: boolean;
    query?: string;
    results?: SearchResult[];
    document?: Document;
    error?: string;
}

export function CorpusExplorer(): React.ReactElement {
    const data = getToolOutput<CorpusData>();
    const textMessage = getToolText();

    if (!data || data.error) {
        return (
            <div className="p-4">
                <h1 className="title mb-4">Corpus Explorer</h1>
                <div className="empty-state">
                    {data?.error || 'Search the legal corpus to view documents and citations.'}
                </div>
            </div>
        );
    }

    // Render search results
    if (data.results && data.results.length > 0) {
        return (
            <div className="p-4">
                <h1 className="title mb-3">Corpus Explorer</h1>
                {data.query && (
                    <p className="caption mb-4">
                        Found {data.results.length} results for "{data.query}"
                    </p>
                )}
                <ul className="list">
                    {data.results.map((result) => (
                        <li key={result.id} className="list-item">
                            <div className="flex justify-between items-center mb-2">
                                <strong>{result.documentName}</strong>
                                <span className="badge">{result.jurisdiction}</span>
                            </div>
                            <p className="text-muted" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                                {result.excerpt}...
                            </p>
                            {result.sourceUrl && (
                                <a
                                    href={result.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="caption"
                                    style={{ color: 'var(--color-primary)' }}
                                >
                                    View source →
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    // Render single document
    if (data.document) {
        const doc = data.document;
        return (
            <div className="p-4">
                <h1 className="title mb-2">{doc.name}</h1>
                <div className="flex gap-2 mb-4">
                    <span className="badge">{doc.jurisdiction}</span>
                    <span className="badge">{doc.chunkCount} chunks</span>
                    <span className="badge">{doc.summaryStatus}</span>
                </div>

                {doc.summary && (
                    <div className="mb-4">
                        <h2 className="subtitle mb-2">Summary</h2>
                        <p style={{ lineHeight: '1.7' }}>{doc.summary}</p>
                    </div>
                )}

                {doc.keyPoints && doc.keyPoints.length > 0 && (
                    <div className="mb-4">
                        <h2 className="subtitle mb-2">Key Points</h2>
                        <ul style={{ paddingLeft: '20px' }}>
                            {doc.keyPoints.map((point, idx) => (
                                <li key={idx} style={{ marginBottom: '8px' }}>{point}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {doc.sourceUrl && (
                    <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                    >
                        View original source
                    </a>
                )}
            </div>
        );
    }

    // Fallback with text message
    return (
        <div className="p-4">
            <h1 className="title mb-4">Corpus Explorer</h1>
            {textMessage ? (
                <p>{textMessage}</p>
            ) : (
                <div className="empty-state">No results to display.</div>
            )}
        </div>
    );
}

export default CorpusExplorer;
