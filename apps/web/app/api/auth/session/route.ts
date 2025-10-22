import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const headerOrg = request.headers.get('x-org-id');
  const headerUser = request.headers.get('x-user-id');
  const orgId = headerOrg ?? cookieStore.get('org_id')?.value ?? null;
  const userId = headerUser ?? cookieStore.get('user_id')?.value ?? null;

  if (!orgId || !userId) {
    return NextResponse.json({ session: null, isDemo: false }, { status: 401 });
  }

  return NextResponse.json({ session: { orgId, userId }, isDemo: false });
}
