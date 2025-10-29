import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
interface ChatkitRouteOptions {
    supabase: SupabaseClient;
}
export declare function registerChatkitRoutes(app: FastifyInstance, { supabase }: ChatkitRouteOptions): void;
export {};
//# sourceMappingURL=chatkit.d.ts.map