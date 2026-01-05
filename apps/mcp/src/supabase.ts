/**
 * Supabase client factory for MCP server
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { McpEnv } from './env.js';

let cachedClient: SupabaseClient | null = null;

export function createSupabaseClient(env: McpEnv): SupabaseClient {
    if (cachedClient) {
        return cachedClient;
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    cachedClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return cachedClient;
}
