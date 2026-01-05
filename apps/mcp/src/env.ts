/**
 * Environment configuration for MCP server
 */

export interface McpEnv {
    PORT: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    API_BASE_URL: string;
    OPENAI_API_KEY: string | undefined;
    SUPABASE_EDGE_URL: string | undefined;
    OPENAI_VECTOR_STORE_AUTHORITIES_ID: string | undefined;
}

const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'API_BASE_URL',
] as const;

export function createEnv(): McpEnv {
    // Load from process.env (supports dotenv)
    const missing: string[] = [];

    for (const key of requiredEnvVars) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        console.warn(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
        console.warn('   Some features may not work correctly.');
    }

    return {
        PORT: process.env.PORT ?? '8787',
        SUPABASE_URL: process.env.SUPABASE_URL ?? '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        SUPABASE_EDGE_URL: process.env.SUPABASE_EDGE_URL,
        OPENAI_VECTOR_STORE_AUTHORITIES_ID: process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID,
    };
}
