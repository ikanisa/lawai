import { getJobs, queueJob } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getJobs(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    await queueJob(orgId, body?.type ?? 'generic', actorId, body?.payload);
    return respond({ status: 'queued' });
  } catch (error) {
    return respondError(error);
  }
}
