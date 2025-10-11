import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    SUPABASE_URL: z.ZodString;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodString;
}, "strip", z.ZodTypeAny, {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}, {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}>;
export type SupabaseEnv = z.infer<typeof envSchema>;
export declare function createServiceClient(env: SupabaseEnv): SupabaseClient;
export {};
//# sourceMappingURL=client.d.ts.map