import { getPermissionsMatrix } from './autonomous-suite';
export function resolvePermissionRoles(action) {
    const manifest = getPermissionsMatrix();
    return manifest[action] ?? [];
}
