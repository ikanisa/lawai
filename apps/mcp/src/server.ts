/**
 * MCP Server for ChatGPT App Store Integration
 * Exposes lawai capabilities as MCP tools for ChatGPT
 */

// Load environment variables from .env file
import 'dotenv/config';

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { registerCorpusTools } from './tools/corpus.js';
import { registerCrawlerTools } from './tools/crawler.js';
import { registerGovernanceTools } from './tools/governance.js';
import { registerReleaseTools } from './tools/release.js';
import { registerWidgetResources } from './widgets/index.js';
import { createEnv } from './env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = createEnv();
const port = Number(env.PORT ?? 8787);
const MCP_PATH = '/mcp';

/**
 * Create and configure the MCP server with all tools and resources
 */
function createMcpServer(): McpServer {
    const server = new McpServer({
        name: 'lawai-chatgpt-app',
        version: '0.1.0',
    });

    // Register all tools
    registerCorpusTools(server, env);
    registerCrawlerTools(server, env);
    registerGovernanceTools(server, env);
    registerReleaseTools(server, env);

    // Register widget resources
    registerWidgetResources(server, __dirname);

    return server;
}

/**
 * Set CORS headers for ChatGPT domain access
 */
function setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id, x-org-id, x-user-id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(res: ServerResponse): void {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
}

/**
 * Serve widget preview pages for local development
 */
function serveWidgetPreview(pathname: string, res: ServerResponse): boolean {
    const widgetName = pathname.replace('/preview/', '');
    const widgetPath = join(__dirname, '../widgets/dist', `${widgetName}.html`);

    if (existsSync(widgetPath)) {
        const content = readFileSync(widgetPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return true;
    }

    return false;
}

/**
 * Main HTTP server handling MCP requests
 */
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
        res.writeHead(400).end('Missing URL');
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        handlePreflight(res);
        return;
    }

    // Health check endpoint
    if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            name: 'lawai-chatgpt-app',
            version: '0.1.0',
            status: 'ok',
            endpoints: {
                mcp: MCP_PATH,
                health: '/',
            },
        }));
        return;
    }

    // Widget preview endpoints (local dev only)
    if (req.method === 'GET' && pathname.startsWith('/preview/')) {
        if (serveWidgetPreview(pathname, res)) {
            return;
        }
    }

    // MCP endpoint
    const MCP_METHODS = new Set(['POST', 'GET', 'DELETE']);
    if (pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
        setCorsHeaders(res);

        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode
            enableJsonResponse: true,
        });

        res.on('close', () => {
            transport.close();
            server.close();
        });

        try {
            await server.connect(transport);
            await transport.handleRequest(req, res);
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        }
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
});

httpServer.listen(port, () => {
    console.log(`🚀 Lawai MCP server listening on http://localhost:${port}`);
    console.log(`   MCP endpoint: http://localhost:${port}${MCP_PATH}`);
    console.log(`   Health check: http://localhost:${port}/`);
});
