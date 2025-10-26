import { NextResponse, type NextRequest } from 'next/server';
import { resolveClientSession } from '@/server/session';

export async function GET(request: NextRequest) {
  const session = await resolveClientSession(request);
  return NextResponse.json({ data: session }, { status: 200 });
}
