import { getWorkflows, promoteWorkflow, queueJob, rollbackWorkflow } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';


export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getWorkflows(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, actorId } = await requireAdminContext(request);
    const body = await request.json();
    if (body?.action === 'promote' && body.payload?.workflowId) {
      await promoteWorkflow(orgId, body.payload.workflowId, actorId);
      await queueJob(orgId, 'workflow-promote', actorId, { workflowId: body.payload.workflowId });
      return respond({ status: 'promoted' });
    }
    if (body?.action === 'rollback' && body.payload?.workflowId) {
      await rollbackWorkflow(orgId, body.payload.workflowId, actorId);
      return respond({ status: 'rolled-back' });
    }
    return respond({ status: 'noop' });
  } catch (error) {
    return respondError(error);
  }
}
