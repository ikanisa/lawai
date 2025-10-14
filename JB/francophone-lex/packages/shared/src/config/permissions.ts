import { getPermissionsMatrix } from './autonomous-suite';

type PermissionsMatrix = ReturnType<typeof getPermissionsMatrix>;

export function resolvePermissionRoles(action: keyof PermissionsMatrix | string) {
  const manifest = getPermissionsMatrix();
  return manifest[action as keyof PermissionsMatrix] ?? [];
}
