import 'server-only';

import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { AuthError, Session } from '@supabase/supabase-js';

import { serverEnv } from '../../env.server';

export interface ServerSession {
  session: Session | null;
  orgId: string | null;
  userId: string | null;
  error: AuthError | null;
}

type SessionMetadata = {
  org_id?: string;
  orgId?: string;
  user_id?: string;
  userId?: string;
  [key: string]: unknown;
};

export async function getServerSession(): Promise<ServerSession> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
    supabaseUrl: serverEnv.SUPABASE_URL,
    supabaseKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  });

  let session: Session | null = null;
  let error: AuthError | null = null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    error = sessionError;
  }
  session = sessionData?.session ?? null;

  if (!session && !error) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      error = refreshError;
    } else {
      session = refreshed?.session ?? null;
    }
  }

  const metadata: SessionMetadata = (session?.user.user_metadata ?? {}) as SessionMetadata;
  const orgId =
    typeof metadata.org_id === 'string'
      ? metadata.org_id
      : typeof metadata.orgId === 'string'
        ? metadata.orgId
        : null;
  const userId =
    typeof metadata.user_id === 'string'
      ? metadata.user_id
      : typeof metadata.userId === 'string'
        ? metadata.userId
        : session?.user?.id ?? null;

  return { session, orgId, userId, error };
}
