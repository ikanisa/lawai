import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { serverEnv } from '../../env.server';

export interface RouteSession {
  accessToken: string;
  user: User;
}

let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient {
  if (authClient) {
    return authClient;
  }
  authClient = createClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return authClient;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== 'bearer') return null;
  const token = parts[1]?.trim();
  return token?.length ? token : null;
}

export async function getSupabaseRouteSession(request: Request): Promise<RouteSession | null> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return null;
  }
  const client = getAuthClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) {
    return null;
  }
  return { accessToken, user: data.user };
}
