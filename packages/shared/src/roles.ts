/**
 * Role-Based Access Control (RBAC) Constants
 * 
 * Single source of truth for roles and permissions across the application.
 */

/**
 * Available roles in the system
 */
export const ROLES = {
    VIEWER: 'viewer',
    MEMBER: 'member',
    REVIEWER: 'reviewer',
    COMPLIANCE_OFFICER: 'compliance_officer',
    AUDITOR: 'auditor',
    ORG_ADMIN: 'org_admin',
    SYSTEM_ADMIN: 'system_admin',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
export type UserRole = Role; // Alias for compatibility with auth package

/**
 * Role hierarchy - higher number = more privileges
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
    viewer: 0,
    member: 1,
    reviewer: 2,
    compliance_officer: 3,
    auditor: 3,
    org_admin: 4,
    system_admin: 5,
};

/**
 * Permission definitions
 */
export const PERMISSIONS = {
    // Case management
    'cases:view': ['viewer', 'member', 'reviewer', 'compliance_officer', 'auditor', 'org_admin', 'system_admin'],
    'cases:create': ['member', 'reviewer', 'org_admin', 'system_admin'],
    'cases:edit': ['member', 'reviewer', 'org_admin', 'system_admin'],
    'cases:delete': ['org_admin', 'system_admin'],

    // Agent operations
    'agent:run': ['member', 'reviewer', 'compliance_officer', 'org_admin', 'system_admin'],
    'agent:configure': ['org_admin', 'system_admin'],

    // HITL review
    'hitl:view': ['reviewer', 'compliance_officer', 'org_admin', 'system_admin'],
    'hitl:review': ['reviewer', 'compliance_officer', 'org_admin', 'system_admin'],
    'hitl:override': ['org_admin', 'system_admin'],

    // Audit
    'audit:view': ['compliance_officer', 'auditor', 'org_admin', 'system_admin'],
    'audit:export': ['auditor', 'org_admin', 'system_admin'],

    // User management
    'users:view': ['org_admin', 'system_admin'],
    'users:manage': ['org_admin', 'system_admin'],
    'users:invite': ['org_admin', 'system_admin'],

    // Organization management
    'orgs:view': ['org_admin', 'system_admin'],
    'orgs:manage': ['system_admin'],

    // System configuration
    'system:config': ['system_admin'],
    'system:admin': ['system_admin'],

    // Corpus/Knowledge base
    'corpus:view': ['member', 'reviewer', 'compliance_officer', 'auditor', 'org_admin', 'system_admin'],
    'corpus:manage': ['org_admin', 'system_admin'],

    // Evaluations
    'evals:view': ['reviewer', 'compliance_officer', 'org_admin', 'system_admin'],
    'evals:run': ['org_admin', 'system_admin'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    // Fix: cast the readonly tuple to string array for includes check compatibility
    const allowedRoles = PERMISSIONS[permission] as readonly string[];
    return allowedRoles.includes(role);
}

/**
 * Check if a role meets or exceeds a minimum role level
 */
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
    return (Object.keys(PERMISSIONS) as Permission[]).filter(
        (permission) => hasPermission(role, permission)
    );
}

/**
 * Route access mapping
 */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
    '/workspace': 'cases:view',
    '/workspace/agent': 'agent:run',
    '/workspace/matters': 'cases:view',
    '/staff': 'hitl:view',
    '/staff/queue': 'hitl:review',
    '/admin': 'users:view',
    '/admin/users': 'users:manage',
    '/admin/orgs': 'orgs:manage',
    '/admin/settings': 'system:config',
};
