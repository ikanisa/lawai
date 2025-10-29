import { randomUUID } from 'node:crypto';
import { env } from './config.js';
const CHATKIT_BASE_URL = env.OPENAI_CHATKIT_BASE_URL ?? 'https://api.openai.com/v1/chatkit';
const CHATKIT_DEFAULT_MODEL = env.OPENAI_CHATKIT_MODEL ?? env.AGENT_MODEL ?? 'gpt-4o-mini';
const CHATKIT_REQUEST_TAGS = process.env.OPENAI_REQUEST_TAGS_CHATKIT ??
    process.env.OPENAI_REQUEST_TAGS_API ??
    process.env.OPENAI_REQUEST_TAGS ??
    'service=api,component=chatkit';
function isChatKitConfigured() {
    return Boolean(env.OPENAI_CHATKIT_SECRET && env.OPENAI_CHATKIT_SECRET.trim().length > 0);
}
function mapSessionRow(row) {
    return {
        id: String(row.id),
        orgId: String(row.org_id),
        userId: String(row.user_id),
        agentName: String(row.agent_name ?? 'agent'),
        channel: row.channel ?? 'web',
        status: row.status ?? 'active',
        chatkitSessionId: row.chatkit_session_id ?? null,
        createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
        endedAt: row.ended_at ? String(row.ended_at) : null,
        metadata: row.metadata ?? {},
    };
}
function toChatKitDetails(source, includeSecret = false) {
    const secret = includeSecret ? source.client_secret?.value ?? null : undefined;
    const secretExpiry = includeSecret ? source.client_secret?.expires_at ?? null : undefined;
    return {
        sessionId: source.id,
        status: source.status ?? null,
        url: source.url ?? null,
        expiresAt: source.expires_at ?? null,
        metadata: source.metadata ?? null,
        clientSecret: secret,
        clientSecretExpiresAt: secretExpiry,
    };
}
async function requestChatKit(path, init, logger, errorTag) {
    if (!isChatKitConfigured()) {
        throw new Error('chatkit_not_configured');
    }
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${env.OPENAI_CHATKIT_SECRET}`);
    if (env.OPENAI_CHATKIT_PROJECT) {
        headers.set('OpenAI-Project', env.OPENAI_CHATKIT_PROJECT);
    }
    if (!headers.has('OpenAI-Request-Tags') && CHATKIT_REQUEST_TAGS) {
        headers.set('OpenAI-Request-Tags', CHATKIT_REQUEST_TAGS);
    }
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`${CHATKIT_BASE_URL}${path}`, {
        ...init,
        headers,
    });
    if (!response.ok) {
        let details = null;
        try {
            details = await response.json();
        }
        catch (_error) {
            details = await response.text().catch(() => null);
        }
        logger?.error?.({
            status: response.status,
            path,
            details,
        }, `${errorTag}_failed`);
        throw new Error(`${errorTag}_failed`);
    }
    if (response.status === 204) {
        return undefined;
    }
    return (await response.json());
}
async function createRemoteChatKitSession(params, logger) {
    const payload = {
        model: CHATKIT_DEFAULT_MODEL,
        metadata: {
            orgId: params.orgId,
            userId: params.userId,
            agentName: params.agentName,
            channel: params.channel,
            ...params.metadata,
        },
    };
    if (params.channel === 'voice' && !('voice' in payload)) {
        payload.voice = 'verse';
    }
    const response = await requestChatKit('/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
    }, logger, 'chatkit_session_create');
    return toChatKitDetails(response, true);
}
async function fetchRemoteChatKitSession(sessionId, logger, options) {
    if (!isChatKitConfigured()) {
        return null;
    }
    const response = await requestChatKit(`/sessions/${sessionId}`, {
        method: 'GET',
    }, logger, 'chatkit_session_fetch');
    return toChatKitDetails(response, options?.includeSecret ?? false);
}
async function cancelRemoteChatKitSession(sessionId, logger) {
    if (!isChatKitConfigured()) {
        return null;
    }
    const response = await requestChatKit(`/sessions/${sessionId}/cancel`, {
        method: 'POST',
    }, logger, 'chatkit_session_cancel');
    if (!response) {
        return null;
    }
    return toChatKitDetails(response, false);
}
export async function createChatSession(supabase, params, logger) {
    const sessionId = randomUUID();
    const channel = params.channel ?? 'web';
    const agentName = params.agentName ?? 'avocat-francophone';
    const metadata = params.metadata ?? {};
    let chatkitSessionId = params.chatkitSessionId ?? null;
    let chatkitDetails = null;
    if (isChatKitConfigured()) {
        const remote = await createRemoteChatKitSession({
            orgId: params.orgId,
            userId: params.userId,
            agentName,
            channel,
            metadata,
        }, logger);
        chatkitSessionId = remote.sessionId;
        chatkitDetails = remote;
    }
    const insertPayload = {
        id: sessionId,
        org_id: params.orgId,
        user_id: params.userId,
        agent_name: agentName,
        channel,
        status: 'active',
        chatkit_session_id: chatkitSessionId ?? sessionId,
        metadata,
    };
    const { data, error } = await supabase
        .from('chat_sessions')
        .insert(insertPayload)
        .select('id, org_id, user_id, agent_name, channel, status, chatkit_session_id, created_at, ended_at, metadata')
        .single();
    if (error || !data) {
        logger?.error?.({ error: error?.message ?? 'insert_failed', insertPayload }, 'chat_session_insert_failed');
        throw new Error(error?.message ?? 'chat_session_insert_failed');
    }
    const session = mapSessionRow(data);
    return chatkitDetails ? { ...session, chatkit: chatkitDetails } : session;
}
export async function getChatSession(supabase, sessionId, options) {
    const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, org_id, user_id, agent_name, channel, status, chatkit_session_id, created_at, ended_at, metadata')
        .eq('id', sessionId)
        .maybeSingle();
    if (error) {
        throw new Error(error.message);
    }
    if (!data) {
        return null;
    }
    const session = mapSessionRow(data);
    if (!options?.includeChatkit || !session.chatkitSessionId || !isChatKitConfigured()) {
        return session;
    }
    const remote = await fetchRemoteChatKitSession(session.chatkitSessionId, options.logger, {
        includeSecret: options?.includeChatkitSecret,
    });
    return remote ? { ...session, chatkit: remote } : session;
}
export async function cancelChatSession(supabase, sessionId, options) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: now })
        .eq('id', sessionId)
        .select('id, org_id, user_id, agent_name, channel, status, chatkit_session_id, created_at, ended_at, metadata')
        .maybeSingle();
    if (error) {
        throw new Error(error.message);
    }
    if (!data) {
        return null;
    }
    const session = mapSessionRow(data);
    const shouldCancelRemote = options?.cancelRemote ?? true;
    if (!shouldCancelRemote || !session.chatkitSessionId || !isChatKitConfigured()) {
        return session;
    }
    const remote = await cancelRemoteChatKitSession(session.chatkitSessionId, options?.logger);
    return remote ? { ...session, chatkit: remote } : session;
}
export async function recordChatEvent(supabase, event) {
    const payload = {
        session_id: event.sessionId,
        event_type: event.type,
        payload: event.payload ?? {},
        actor_type: event.actorType ?? null,
        actor_id: event.actorId ?? null,
    };
    const { error } = await supabase.from('chat_events').insert(payload);
    if (error) {
        throw new Error(error.message);
    }
}
export async function listSessionsForOrg(supabase, orgId, status) {
    let query = supabase
        .from('chat_sessions')
        .select('id, org_id, user_id, agent_name, channel, status, chatkit_session_id, created_at, ended_at, metadata')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
    if (status) {
        query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) {
        throw new Error(error.message);
    }
    return (data ?? []).map(mapSessionRow);
}
