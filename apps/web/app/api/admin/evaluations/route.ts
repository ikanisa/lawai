import { getEvaluations, queueJob } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';


export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getEvaluations(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    await queueJob(orgId, 'eval-nightly', actorId);
    return respond({ status: 'queued' });
  } catch (error) {
    return respondError(error);
  }
}
