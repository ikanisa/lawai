import { NextResponse } from 'next/server';

import { getServerAuthSession } from '../../../../src/server/auth/session';
import type { SessionPayload } from '../../../../src/types/session';

export async function GET() {
  const { session, orgId, userId, isDemo, hasRealIdentity, error } = await getServerAuthSession();
  const headers = new Headers({ 'Cache-Control': 'no-store' });

  if (error) {
    console.error('Failed to retrieve Supabase session', error);
    return new NextResponse('Failed to retrieve session', { status: 500, headers });
  }

  if (!session || !hasRealIdentity || !orgId || !userId) {
    return new NextResponse(null, { status: 401, headers });
  }

  const payload: SessionPayload = {
    session: { orgId, userId },
    isDemo,
  };

  return NextResponse.json(payload, { headers });
}
