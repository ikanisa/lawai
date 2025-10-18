import { getPolicies, savePolicy } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getPolicies(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'upsert' && body.payload?.key) {
      const record = await savePolicy(orgId, body.payload.key, body.payload.value ?? false, actorId);
      return respond({ status: 'updated', record });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}
