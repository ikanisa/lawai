import { getPermissionsMatrix } from './autonomous-suite';
type PermissionsMatrix = ReturnType<typeof getPermissionsMatrix>;
export declare function resolvePermissionRoles(action: keyof PermissionsMatrix | string): readonly ["member", "reviewer", "admin", "owner"] | readonly ["reviewer", "admin", "owner"] | readonly ["admin", "owner"] | readonly ["admin", "owner", "compliance_officer"] | readonly ["owner"] | readonly ["auditor", "compliance_officer", "admin", "owner"];
export {};
//# sourceMappingURL=permissions.d.ts.map