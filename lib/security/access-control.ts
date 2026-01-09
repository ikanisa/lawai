/**
 * Enhanced Access Control
 * Role-based and resource-based access control
 */

import { prisma } from '@/lib/db';

export type Permission = 
  | 'matter:read'
  | 'matter:write'
  | 'matter:delete'
  | 'vault:read'
  | 'vault:write'
  | 'vault:delete'
  | 'workflow:read'
  | 'workflow:write'
  | 'workflow:execute'
  | 'document:read'
  | 'document:write'
  | 'document:delete'
  | 'user:read'
  | 'user:write'
  | 'admin:all';

interface AccessCheck {
  userId: string;
  resourceType: 'matter' | 'vault' | 'workflow' | 'document' | 'case';
  resourceId: string;
  permission: Permission;
}

/**
 * Check if user has permission to access a resource
 */
export async function checkAccess({
  userId,
  resourceType,
  resourceId,
  permission,
}: AccessCheck): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      return false;
    }

    // Admins have all permissions
    if (user.role === 'ADMIN') {
      return true;
    }

    // Check resource-specific permissions
    switch (resourceType) {
      case 'matter':
        return await checkMatterAccess(userId, resourceId, permission, user.organizationId);
      case 'vault':
        return await checkVaultAccess(userId, resourceId, permission, user.organizationId);
      case 'workflow':
        return await checkWorkflowAccess(userId, resourceId, permission, user.organizationId);
      case 'document':
        return await checkDocumentAccess(userId, resourceId, permission, user.organizationId);
      case 'case':
        return await checkCaseAccess(userId, resourceId, permission, user.organizationId);
      default:
        return false;
    }
  } catch (error) {
    console.error('Access check error:', error);
    return false;
  }
}

/**
 * Check matter access
 */
async function checkMatterAccess(
  userId: string,
  matterId: string,
  permission: Permission,
  organizationId: string
): Promise<boolean> {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      organizationId,
      OR: [
        { ownerId: userId },
        {
          teamMembers: {
            some: {
              userId,
              role: permission.includes('write') || permission.includes('delete')
                ? { in: ['editor', 'contributor'] }
                : undefined,
            },
          },
        },
      ],
    },
  });

  return !!matter;
}

/**
 * Check vault access
 */
async function checkVaultAccess(
  userId: string,
  vaultId: string,
  permission: Permission,
  organizationId: string
): Promise<boolean> {
  const vault = await prisma.vault.findFirst({
    where: {
      id: vaultId,
      matter: {
        organizationId,
        OR: [
          { ownerId: userId },
          {
            teamMembers: {
              some: {
                userId,
                role: permission.includes('write') || permission.includes('delete')
                  ? { in: ['editor', 'contributor'] }
                  : undefined,
              },
            },
          },
        ],
      },
    },
  });

  return !!vault;
}

/**
 * Check workflow access
 */
async function checkWorkflowAccess(
  userId: string,
  workflowId: string,
  permission: Permission,
  organizationId: string
): Promise<boolean> {
  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowId,
      organizationId,
      OR: [
        { createdById: userId },
        { isPublic: true },
      ],
    },
  });

  return !!workflow;
}

/**
 * Check document access
 */
async function checkDocumentAccess(
  userId: string,
  documentId: string,
  permission: Permission,
  organizationId: string
): Promise<boolean> {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [
        { userId },
        {
          vault: {
            matter: {
              organizationId,
              OR: [
                { ownerId: userId },
                {
                  teamMembers: {
                    some: { userId },
                  },
                },
              ],
            },
          },
        },
        {
          case: {
            matter: {
              organizationId,
              OR: [
                { ownerId: userId },
                {
                  teamMembers: {
                    some: { userId },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  });

  return !!document;
}

/**
 * Check case access
 */
async function checkCaseAccess(
  userId: string,
  caseId: string,
  permission: Permission,
  organizationId: string
): Promise<boolean> {
  const case_ = await prisma.case.findFirst({
    where: {
      id: caseId,
      matter: {
        organizationId,
        OR: [
          { ownerId: userId },
          {
            teamMembers: {
              some: { userId },
            },
          },
        ],
      },
    },
  });

  return !!case_;
}

/**
 * Require access - throws error if access denied
 */
export async function requireAccess(
  accessCheck: AccessCheck
): Promise<void> {
  const hasAccess = await checkAccess(accessCheck);
  if (!hasAccess) {
    throw new Error('Access denied');
  }
}

/**
 * Get user's effective permissions for a resource
 */
export async function getUserPermissions(
  userId: string,
  resourceType: AccessCheck['resourceType'],
  resourceId: string
): Promise<Permission[]> {
  const permissions: Permission[] = [];

  const readPermission = `${resourceType}:read` as Permission;
  const writePermission = `${resourceType}:write` as Permission;
  const deletePermission = `${resourceType}:delete` as Permission;

  if (await checkAccess({ userId, resourceType, resourceId, permission: readPermission })) {
    permissions.push(readPermission);
  }

  if (await checkAccess({ userId, resourceType, resourceId, permission: writePermission })) {
    permissions.push(writePermission);
  }

  if (await checkAccess({ userId, resourceType, resourceId, permission: deletePermission })) {
    permissions.push(deletePermission);
  }

  return permissions;
}
