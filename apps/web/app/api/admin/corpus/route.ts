import { getCorpus } from '../../../../src/server/admin/handlers';
import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';

export async function GET(request: Request) {
  try {
    const { orgId } = await requireAdminContext(request);
    const data = await getCorpus(orgId);
    return respond(data);
  } catch (error) {
    return respondError(error);
  }
}
