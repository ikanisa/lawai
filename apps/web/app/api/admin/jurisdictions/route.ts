import { getJurisdictions, saveEntitlement } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getJurisdictions(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'toggle' && body.payload) {
      await saveEntitlement(orgId, body.payload.jurisdiction, body.payload.entitlement, Boolean(body.payload.enabled), actorId);
      return respond({ status: 'updated' });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}
