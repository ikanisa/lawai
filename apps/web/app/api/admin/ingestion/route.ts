import { getIngestion, queueJob } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getIngestion(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    const action = body?.action ?? 'start';
    await queueJob(orgId, `ingestion-${action}`, actorId);
    return respond({ status: 'queued', action });
  } catch (error) {
    return respondError(error);
  }
}
