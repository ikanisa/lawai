import { getPeople, invitePerson, updatePerson } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getPeople(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'invite' && body.payload?.email && body.payload?.role) {
      const record = await invitePerson(orgId, body.payload.email, body.payload.role, actorId);
      return respond({ status: 'invited', record });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'update' && body.payload?.id) {
      const record = await updatePerson(orgId, body.payload.id, body.payload, actorId);
      return respond({ status: 'updated', record });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}
