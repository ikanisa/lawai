import { getPermissionsMatrix } from './autonomous-suite';

type PermissionsMatrix = ReturnType<typeof getPermissionsMatrix>;

export function resolvePermissionRoles(action: keyof PermissionsMatrix): readonly string[];
export function resolvePermissionRoles(action: string): readonly string[];
export function resolvePermissionRoles(action: string): readonly string[] {
  const manifest = getPermissionsMatrix();
  return manifest[action as keyof PermissionsMatrix] ?? [];
}
