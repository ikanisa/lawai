import type { SupabaseClient } from '@supabase/supabase-js';
export type ChatSessionChannel = 'web' | 'voice';
export type ChatSessionStatus = 'active' | 'ended';
type Logger = {
    error: (data: Record<string, unknown>, message: string) => void;
    warn?: (data: Record<string, unknown>, message: string) => void;
};
export interface CreateChatSessionInput {
    orgId: string;
    userId: string;
    agentName?: string;
    channel?: ChatSessionChannel;
    metadata?: Record<string, unknown>;
    chatkitSessionId?: string | null;
}
export interface ChatSession {
    id: string;
    orgId: string;
    userId: string;
    agentName: string;
    channel: ChatSessionChannel;
    status: ChatSessionStatus;
    chatkitSessionId: string | null;
    createdAt: string;
    endedAt: string | null;
    metadata: Record<string, unknown>;
}
export interface ChatKitSessionDetails {
    sessionId: string;
    status: string | null;
    url: string | null;
    expiresAt: string | null;
    metadata: Record<string, unknown> | null;
    clientSecret?: string | null;
    clientSecretExpiresAt?: string | null;
}
export interface ChatSessionRecord extends ChatSession {
    chatkit?: ChatKitSessionDetails | null;
}
export interface ChatEventInput {
    sessionId: string;
    type: string;
    payload?: Record<string, unknown>;
    actorType?: string;
    actorId?: string;
}
export declare function createChatSession(supabase: SupabaseClient, params: CreateChatSessionInput, logger?: Logger): Promise<ChatSessionRecord>;
export declare function getChatSession(supabase: SupabaseClient, sessionId: string, options?: {
    includeChatkit?: boolean;
    includeChatkitSecret?: boolean;
    logger?: Logger;
}): Promise<ChatSessionRecord | null>;
export declare function cancelChatSession(supabase: SupabaseClient, sessionId: string, options?: {
    logger?: Logger;
    cancelRemote?: boolean;
}): Promise<ChatSessionRecord | null>;
export declare function recordChatEvent(supabase: SupabaseClient, event: ChatEventInput): Promise<void>;
export declare function listSessionsForOrg(supabase: SupabaseClient, orgId: string, status?: ChatSessionStatus): Promise<ChatSession[]>;
export {};
//# sourceMappingURL=chatkit.d.ts.map