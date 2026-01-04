import { getHitlQueue, recordHitlDecision } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';


export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getHitlQueue(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'decision' && body.payload?.id && body.payload?.action) {
      await recordHitlDecision(orgId, body.payload.id, body.payload.action, actorId);
      return respond({ status: 'recorded' });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}
