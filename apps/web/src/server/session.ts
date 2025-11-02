import type { SessionValue } from '@avocat-ai/auth';
import { getSupabaseSession } from './supabase/session';

export type ClientSession = SessionValue;

export async function resolveClientSession(request?: Request): Promise<ClientSession | null> {
  const supabaseSession = await getSupabaseSession(request);
  if (!supabaseSession) {
    return null;
  }
  const orgId = supabaseSession.organizations[0];
  const userId = supabaseSession.actorId ?? supabaseSession.user.id ?? null;
  if (!orgId || !userId) {
    return null;
  }
  return { orgId, userId };
}
