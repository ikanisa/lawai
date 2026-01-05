/**
 * Widget resource registration for MCP server
 * Registers UI bundles with text/html+skybridge mime type
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Inline widget templates for initial development
// In production, these would be built from apps/chatgpt-ui

const CORPUS_EXPLORER_WIDGET = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 16px; }
    .dark body { background: #0d0d0d; color: #e5e5e5; }
    .header { margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .search-form { display: flex; gap: 8px; margin-bottom: 16px; }
    .search-input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
    .dark .search-input { background: #1f1f1f; border-color: #404040; color: #e5e5e5; }
    .search-btn { padding: 8px 16px; background: #10a37f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .search-btn:hover { background: #0d8c6d; }
    .results { list-style: none; }
    .result-item { padding: 12px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 8px; }
    .dark .result-item { border-color: #333; }
    .result-title { font-weight: 500; margin-bottom: 4px; }
    .result-meta { font-size: 12px; color: #666; margin-bottom: 8px; }
    .dark .result-meta { color: #999; }
    .result-excerpt { font-size: 14px; line-height: 1.5; }
    .empty { text-align: center; color: #666; padding: 32px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background: #e5e5e5; }
    .dark .badge { background: #333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Corpus Explorer</div>
  </div>
  <div id="app">
    <div class="empty">Search the legal corpus to view documents and citations.</div>
  </div>
  <script>
    const toolOutput = window.openai?.toolOutput;
    const data = toolOutput?.structuredContent || {};
    const app = document.getElementById('app');
    
    if (data.results && data.results.length > 0) {
      app.innerHTML = '<ul class="results">' + data.results.map(r => 
        '<li class="result-item">' +
          '<div class="result-title">' + (r.documentName || 'Untitled') + '</div>' +
          '<div class="result-meta">' +
            '<span class="badge">' + (r.jurisdiction || 'unknown') + '</span> ' +
            (r.sourceUrl ? '<a href="' + r.sourceUrl + '" target="_blank">Source</a>' : '') +
          '</div>' +
          '<div class="result-excerpt">' + (r.excerpt || '') + '</div>' +
        '</li>'
      ).join('') + '</ul>';
    } else if (data.document) {
      const doc = data.document;
      app.innerHTML = 
        '<div class="result-item">' +
          '<div class="result-title">' + doc.name + '</div>' +
          '<div class="result-meta">' +
            '<span class="badge">' + doc.jurisdiction + '</span> ' +
            '<span class="badge">' + doc.chunkCount + ' chunks</span> ' +
            '<span class="badge">' + doc.summaryStatus + '</span>' +
          '</div>' +
          (doc.summary ? '<p style="margin-top:12px">' + doc.summary + '</p>' : '') +
          (doc.keyPoints ? '<ul style="margin-top:8px;padding-left:20px">' + 
            doc.keyPoints.map(p => '<li>' + p + '</li>').join('') + '</ul>' : '') +
        '</div>';
    }
    
    // Check theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    }
  </script>
</body>
</html>
`;

const GOVERNANCE_DASHBOARD_WIDGET = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 16px; }
    .dark body { background: #0d0d0d; color: #e5e5e5; }
    .title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .metric { padding: 12px; background: #f9f9f9; border-radius: 8px; text-align: center; }
    .dark .metric { background: #1f1f1f; }
    .metric-value { font-size: 24px; font-weight: 700; color: #10a37f; }
    .metric-label { font-size: 12px; color: #666; margin-top: 4px; }
    .dark .metric-label { color: #999; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
    .dark .section-title { color: #999; }
    .snapshot-list { list-style: none; }
    .snapshot-item { padding: 8px 12px; border-left: 3px solid #10a37f; background: #f0fdf4; margin-bottom: 6px; font-size: 13px; }
    .dark .snapshot-item { background: #0d2818; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn-primary { background: #10a37f; color: white; }
    .btn-secondary { background: #e5e5e5; color: #333; }
    .dark .btn-secondary { background: #333; color: #e5e5e5; }
  </style>
</head>
<body>
  <div class="title">Governance Dashboard</div>
  <div id="app"></div>
  <script>
    const toolOutput = window.openai?.toolOutput;
    const data = toolOutput?.structuredContent || {};
    const app = document.getElementById('app');
    
    let html = '';
    
    // Metrics overview
    if (data.overview) {
      const o = data.overview;
      html += '<div class="metrics">' +
        '<div class="metric"><div class="metric-value">' + (o.totalRuns || 0) + '</div><div class="metric-label">Total Runs</div></div>' +
        '<div class="metric"><div class="metric-value">' + (o.avgLatencyMs ? o.avgLatencyMs.toFixed(0) + 'ms' : '-') + '</div><div class="metric-label">Avg Latency</div></div>' +
        '<div class="metric"><div class="metric-value">' + (o.allowlistedCitationRatio ? (o.allowlistedCitationRatio * 100).toFixed(1) + '%' : '-') + '</div><div class="metric-label">Citation Accuracy</div></div>' +
        '<div class="metric"><div class="metric-value">' + (o.hitlPending || 0) + '</div><div class="metric-label">HITL Pending</div></div>' +
      '</div>';
    }
    
    // SLO snapshots
    if (data.snapshots && data.snapshots.length > 0) {
      html += '<div class="section"><div class="section-title">SLO History</div><ul class="snapshot-list">';
      data.snapshots.slice(0, 5).forEach(s => {
        html += '<li class="snapshot-item">' +
          (s.created_at || s.recorded_at || 'Date unknown') + ' - ' +
          'Uptime: ' + (s.api_uptime_percent || '-') + '% | ' +
          'HITL P95: ' + (s.hitl_response_p95_seconds || '-') + 's' +
          (s.notes ? ' (' + s.notes + ')' : '') +
        '</li>';
      });
      html += '</ul></div>';
    }
    
    // Success message
    if (data.success && !data.overview && !data.snapshots) {
      html += '<div class="section" style="color:#10a37f;font-weight:500">✓ ' + 
        (toolOutput?.content?.[0]?.text || 'Operation completed successfully') + '</div>';
    }
    
    app.innerHTML = html || '<div style="color:#666;text-align:center;padding:32px">No governance data available</div>';
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    }
  </script>
</body>
</html>
`;

const RELEASE_READINESS_WIDGET = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 16px; }
    .dark body { background: #0d0d0d; color: #e5e5e5; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 600; }
    .status { padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; }
    .status-ready { background: #dcfce7; color: #166534; }
    .status-not-ready { background: #fee2e2; color: #991b1b; }
    .dark .status-ready { background: #14532d; color: #86efac; }
    .dark .status-not-ready { background: #7f1d1d; color: #fca5a5; }
    .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; margin-bottom: 20px; }
    .section-card { padding: 12px; border-radius: 8px; text-align: center; background: #f3f4f6; }
    .dark .section-card { background: #1f1f1f; }
    .section-card.satisfied { background: #dcfce7; }
    .dark .section-card.satisfied { background: #14532d; }
    .section-card.missing { background: #fee2e2; }
    .dark .section-card.missing { background: #7f1d1d; }
    .section-label { font-size: 20px; font-weight: 700; }
    .section-detail { font-size: 11px; color: #666; margin-top: 4px; }
    .dark .section-detail { color: #999; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
    .dark .info-row { border-color: #333; }
    .info-label { color: #666; }
    .dark .info-label { color: #999; }
    .info-value { font-weight: 500; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    const toolOutput = window.openai?.toolOutput;
    const data = toolOutput?.structuredContent || {};
    const app = document.getElementById('app');
    
    let html = '';
    
    // Header with status
    html += '<div class="header">' +
      '<div class="title">Release Readiness</div>' +
      '<div class="status ' + (data.ready ? 'status-ready' : 'status-not-ready') + '">' +
        (data.ready ? '✓ Ready' : '✗ Not Ready') +
      '</div>' +
    '</div>';
    
    // Section cards
    if (data.sections) {
      html += '<div class="sections">';
      data.sections.forEach(s => {
        const isSatisfied = s.isSatisfied;
        html += '<div class="section-card ' + (isSatisfied ? 'satisfied' : (s.total > 0 ? 'missing' : '')) + '">' +
          '<div class="section-label">' + s.section + '</div>' +
          '<div class="section-detail">' + s.satisfied + '/' + s.total + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    
    // Info rows
    html += '<div class="info-row"><span class="info-label">FRIA Validated</span><span class="info-value">' + 
      (data.friaValidatedCount || 0) + '/' + (data.friaTotal || 0) + '</span></div>';
    html += '<div class="info-row"><span class="info-label">FRIA Status</span><span class="info-value">' + 
      (data.friaSatisfied ? '✓ Satisfied' : '✗ Missing') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">GO Decision</span><span class="info-value">' + 
      (data.hasGoDecision ? '✓ Recorded' : '○ Pending') + '</span></div>';
    
    if (data.missingSections && data.missingSections.length > 0) {
      html += '<div class="info-row"><span class="info-label">Missing Sections</span><span class="info-value" style="color:#dc2626">' + 
        data.missingSections.join(', ') + '</span></div>';
    }
    
    app.innerHTML = html;
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    }
  </script>
</body>
</html>
`;

export function registerWidgetResources(server: McpServer, baseDir: string): void {
    const widgetsDistPath = join(baseDir, '../widgets/dist');

    // Check if built widgets exist, otherwise use inline templates
    const useBuiltWidgets = existsSync(widgetsDistPath);

    /**
     * Corpus Explorer Widget
     */
    server.registerResource(
        'corpus-explorer-widget',
        'ui://widget/corpus-explorer.html',
        {},
        async () => {
            let content = CORPUS_EXPLORER_WIDGET;

            if (useBuiltWidgets) {
                const builtPath = join(widgetsDistPath, 'corpus-explorer.html');
                if (existsSync(builtPath)) {
                    content = readFileSync(builtPath, 'utf8');
                }
            }

            return {
                contents: [
                    {
                        uri: 'ui://widget/corpus-explorer.html',
                        mimeType: 'text/html+skybridge',
                        text: content,
                        _meta: {
                            'openai/widgetPrefersBorder': true,
                            'openai/widgetDomain': 'https://chatgpt.com',
                        },
                    },
                ],
            };
        }
    );

    /**
     * Governance Dashboard Widget
     */
    server.registerResource(
        'governance-dashboard-widget',
        'ui://widget/governance-dashboard.html',
        {},
        async () => {
            let content = GOVERNANCE_DASHBOARD_WIDGET;

            if (useBuiltWidgets) {
                const builtPath = join(widgetsDistPath, 'governance-dashboard.html');
                if (existsSync(builtPath)) {
                    content = readFileSync(builtPath, 'utf8');
                }
            }

            return {
                contents: [
                    {
                        uri: 'ui://widget/governance-dashboard.html',
                        mimeType: 'text/html+skybridge',
                        text: content,
                        _meta: {
                            'openai/widgetPrefersBorder': true,
                            'openai/widgetDomain': 'https://chatgpt.com',
                        },
                    },
                ],
            };
        }
    );

    /**
     * Release Readiness Widget
     */
    server.registerResource(
        'release-readiness-widget',
        'ui://widget/release-readiness.html',
        {},
        async () => {
            let content = RELEASE_READINESS_WIDGET;

            if (useBuiltWidgets) {
                const builtPath = join(widgetsDistPath, 'release-readiness.html');
                if (existsSync(builtPath)) {
                    content = readFileSync(builtPath, 'utf8');
                }
            }

            return {
                contents: [
                    {
                        uri: 'ui://widget/release-readiness.html',
                        mimeType: 'text/html+skybridge',
                        text: content,
                        _meta: {
                            'openai/widgetPrefersBorder': true,
                            'openai/widgetDomain': 'https://chatgpt.com',
                        },
                    },
                ],
            };
        }
    );
}
