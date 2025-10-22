import { getServerSession } from '../../../../src/server/auth/session';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../../../../src/lib/api';

export async function GET() {
  const { session, orgId, userId, error } = await getServerSession();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
  }

  if (!session || !orgId || !userId) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const isDemo = orgId === DEMO_ORG_ID || userId === DEMO_USER_ID;

  return new Response(JSON.stringify({ session, isDemo }), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}
