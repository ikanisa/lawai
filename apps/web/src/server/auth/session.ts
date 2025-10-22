'use server';

import 'server-only';

import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { AuthError, Session } from '@supabase/supabase-js';

import { serverEnv } from '../../env.server';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../../lib/api';
import type { SessionIdentity } from '../../types/session';

interface SupabaseClientOptions {
  cookies: () => ReturnType<typeof cookies>;
  supabaseUrl: string;
  supabaseKey: string;
}

export interface ServerAuthSession {
  session: Session | null;
  orgId: string | null;
  userId: string | null;
  isDemo: boolean;
  hasIdentity: boolean;
  hasRealIdentity: boolean;
  error: AuthError | null;
}

export async function getServerAuthSession(): Promise<ServerAuthSession> {
  const cookieStore = cookies();
  const client = createRouteHandlerClient({
    cookies: () => cookieStore,
    supabaseUrl: serverEnv.SUPABASE_URL,
    supabaseKey: serverEnv.SUPABASE_ANON_KEY,
  } satisfies SupabaseClientOptions);

  const { data, error } = await client.auth.getSession();
  const session = data.session ?? null;
  const identity = extractIdentity(session);
  const orgId = identity?.orgId ?? null;
  const userId = identity?.userId ?? null;

  const isDemoMetadata =
    session?.user.user_metadata?.is_demo === true ||
    session?.user.user_metadata?.isDemo === true ||
    session?.user.user_metadata?.demo === true;

  const isDemo =
    isDemoMetadata ||
    orgId === DEMO_ORG_ID ||
    userId === DEMO_USER_ID;

  const hasIdentity = Boolean(orgId && userId);
  const hasRealIdentity = Boolean(hasIdentity && orgId !== DEMO_ORG_ID && userId !== DEMO_USER_ID);

  return {
    session,
    orgId,
    userId,
    isDemo,
    hasIdentity,
    hasRealIdentity,
    error,
  };
}

function extractIdentity(session: Session | null): SessionIdentity | null {
  if (!session) {
    return null;
  }

  const orgId = readMetadataValue(session.user.user_metadata?.org_id);
  const metadataUserId = readMetadataValue(session.user.user_metadata?.user_id);
  const userId = metadataUserId ?? session.user.id ?? null;

  if (!orgId || !userId) {
    return null;
  }

  return { orgId, userId } satisfies SessionIdentity;
}

function readMetadataValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
