import { authorizeAction, ensureOrgAccessCompliance } from '../access-control.js';
import { recordDeviceSession } from '../device-sessions.js';
async function applyRequestContext(access, request) {
    ensureOrgAccessCompliance(access, {
        ip: request.ip,
        headers: request.headers,
    });
    try {
        await recordDeviceSession({ orgId: access.orgId, userId: access.userId, role: access.role, request });
    }
    catch (error) {
        request.log.error({ err: error, orgId: access.orgId, userId: access.userId }, 'device_session_record_failed');
    }
    return access;
}
export async function authorizeRequestWithGuards(action, orgId, userId, request) {
    const access = await authorizeAction(action, orgId, userId);
    return applyRequestContext(access, request);
}
