import { requireAdminContext, respond, respondError } from '../../../../src/server/admin/auth';


export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext(request);
    return respond({
      orgId: context.orgId,
      actorId: context.actorId,
      environment: context.environment,
      roles: context.roles,
      organizations: context.organizations,
    });
  } catch (error) {
    return respondError(error);
  }
}
