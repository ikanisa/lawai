import { getBilling } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';


export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getBilling(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}
