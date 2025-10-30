import { z } from 'zod';
export declare const nodeEnvironmentSchema: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
export declare const sharedSupabaseSchema: z.ZodObject<{
    SUPABASE_URL: z.ZodString;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodString;
    SUPABASE_MANAGEMENT_API_URL: z.ZodOptional<z.ZodString>;
    SUPABASE_ACCESS_TOKEN: z.ZodOptional<z.ZodString>;
    SUPABASE_PROJECT_REF: z.ZodOptional<z.ZodString>;
    SUPABASE_DB_URL: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SUPABASE_MANAGEMENT_API_URL?: string | undefined;
    SUPABASE_ACCESS_TOKEN?: string | undefined;
    SUPABASE_PROJECT_REF?: string | undefined;
    SUPABASE_DB_URL?: string | undefined;
}, {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SUPABASE_MANAGEMENT_API_URL?: string | undefined;
    SUPABASE_ACCESS_TOKEN?: string | undefined;
    SUPABASE_PROJECT_REF?: string | undefined;
    SUPABASE_DB_URL?: string | undefined;
}>;
export declare const sharedOpenAiSchema: z.ZodObject<{
    OPENAI_API_KEY: z.ZodString;
    OPENAI_BASE_URL: z.ZodOptional<z.ZodString>;
    OPENAI_VECTOR_STORE_AUTHORITIES_ID: z.ZodOptional<z.ZodString>;
    OPENAI_REQUEST_TAGS: z.ZodOptional<z.ZodString>;
    OPENAI_REQUEST_TAGS_API: z.ZodOptional<z.ZodString>;
    OPENAI_REQUEST_TAGS_OPS: z.ZodOptional<z.ZodString>;
    OPENAI_REQUEST_TAGS_EDGE: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    OPENAI_API_KEY: string;
    OPENAI_REQUEST_TAGS?: string | undefined;
    OPENAI_BASE_URL?: string | undefined;
    OPENAI_VECTOR_STORE_AUTHORITIES_ID?: string | undefined;
    OPENAI_REQUEST_TAGS_API?: string | undefined;
    OPENAI_REQUEST_TAGS_OPS?: string | undefined;
    OPENAI_REQUEST_TAGS_EDGE?: string | undefined;
}, {
    OPENAI_API_KEY: string;
    OPENAI_REQUEST_TAGS?: string | undefined;
    OPENAI_BASE_URL?: string | undefined;
    OPENAI_VECTOR_STORE_AUTHORITIES_ID?: string | undefined;
    OPENAI_REQUEST_TAGS_API?: string | undefined;
    OPENAI_REQUEST_TAGS_OPS?: string | undefined;
    OPENAI_REQUEST_TAGS_EDGE?: string | undefined;
}>;
export declare const sharedOptionalIntegrationsSchema: z.ZodObject<{
    JURIS_ALLOWLIST_JSON: z.ZodOptional<z.ZodString>;
    OPENAI_CHATKIT_PROJECT: z.ZodOptional<z.ZodString>;
    OPENAI_CHATKIT_SECRET: z.ZodOptional<z.ZodString>;
    OPENAI_CHATKIT_BASE_URL: z.ZodOptional<z.ZodString>;
    OPENAI_CHATKIT_MODEL: z.ZodOptional<z.ZodString>;
    WA_TOKEN: z.ZodOptional<z.ZodString>;
    WA_PHONE_NUMBER_ID: z.ZodOptional<z.ZodString>;
    WA_TEMPLATE_OTP_NAME: z.ZodOptional<z.ZodString>;
    WA_TEMPLATE_LOCALE: z.ZodOptional<z.ZodString>;
    WA_PROVIDER: z.ZodOptional<z.ZodEnum<["twilio", "meta"]>>;
    C2PA_SIGNING_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
    C2PA_SIGNING_KEY_ID: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    JURIS_ALLOWLIST_JSON?: string | undefined;
    OPENAI_CHATKIT_PROJECT?: string | undefined;
    OPENAI_CHATKIT_SECRET?: string | undefined;
    OPENAI_CHATKIT_BASE_URL?: string | undefined;
    OPENAI_CHATKIT_MODEL?: string | undefined;
    WA_TOKEN?: string | undefined;
    WA_PHONE_NUMBER_ID?: string | undefined;
    WA_TEMPLATE_OTP_NAME?: string | undefined;
    WA_TEMPLATE_LOCALE?: string | undefined;
    WA_PROVIDER?: "twilio" | "meta" | undefined;
    C2PA_SIGNING_PRIVATE_KEY?: string | undefined;
    C2PA_SIGNING_KEY_ID?: string | undefined;
}, {
    JURIS_ALLOWLIST_JSON?: string | undefined;
    OPENAI_CHATKIT_PROJECT?: string | undefined;
    OPENAI_CHATKIT_SECRET?: string | undefined;
    OPENAI_CHATKIT_BASE_URL?: string | undefined;
    OPENAI_CHATKIT_MODEL?: string | undefined;
    WA_TOKEN?: string | undefined;
    WA_PHONE_NUMBER_ID?: string | undefined;
    WA_TEMPLATE_OTP_NAME?: string | undefined;
    WA_TEMPLATE_LOCALE?: string | undefined;
    WA_PROVIDER?: "twilio" | "meta" | undefined;
    C2PA_SIGNING_PRIVATE_KEY?: string | undefined;
    C2PA_SIGNING_KEY_ID?: string | undefined;
}>;
export interface LoadServerEnvOptions {
    dotenv?: boolean;
    source?: Record<string, unknown>;
}
export declare function loadServerEnv<T extends z.ZodTypeAny>(schema: T, { dotenv, source }?: LoadServerEnvOptions): z.infer<T>;
export type SharedSupabaseEnv = z.infer<typeof sharedSupabaseSchema>;
export type SharedOpenAiEnv = z.infer<typeof sharedOpenAiSchema>;
export type SharedOptionalIntegrationsEnv = z.infer<typeof sharedOptionalIntegrationsSchema>;
//# sourceMappingURL=env.d.ts.map