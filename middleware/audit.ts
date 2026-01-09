/**
 * Enhanced Audit Logging Middleware
 * Comprehensive audit trail for compliance (SOC 2, ISO 27001)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface AuditContext {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || null;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get('user-agent');
}

/**
 * Log audit event
 */
export async function logAuditEvent(context: AuditContext): Promise<void> {
  try {
    if (!context.organizationId) {
      // Try to get organization from user if not provided
      if (context.userId) {
        const user = await prisma.user.findUnique({
          where: { id: context.userId },
          select: { organizationId: true },
        });
        if (user) {
          context.organizationId = user.organizationId;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId || 'unknown',
        userId: context.userId,
        action: context.action,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        metadata: context.metadata || {},
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should not break the application
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Create audit middleware for API routes
 */
export function createAuditMiddleware(
  action: string,
  getResourceInfo?: (request: NextRequest) => Promise<{ type?: string; id?: string }>
) {
  return async (request: NextRequest, userId?: string, organizationId?: string) => {
    try {
      const resourceInfo = getResourceInfo
        ? await getResourceInfo(request)
        : { type: undefined, id: undefined };

      await logAuditEvent({
        userId,
        organizationId,
        action,
        resourceType: resourceInfo.type,
        resourceId: resourceInfo.id,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          method: request.method,
          path: request.nextUrl.pathname,
          query: Object.fromEntries(request.nextUrl.searchParams),
        },
      });
    } catch (error) {
      console.error('Audit middleware error:', error);
    }
  };
}

/**
 * Log security events (failed logins, unauthorized access, etc.)
 */
export async function logSecurityEvent(
  eventType: 'LOGIN_FAILED' | 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY',
  request: NextRequest,
  details?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    action: `SECURITY_${eventType}`,
    resourceType: 'security',
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
    metadata: {
      eventType,
      ...details,
      path: request.nextUrl.pathname,
      method: request.method,
    },
  });
}

/**
 * Check if action requires audit logging
 */
export function requiresAuditLog(action: string): boolean {
  const auditActions = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'VIEW',
    'EXPORT',
    'SHARE',
    'DOWNLOAD',
    'UPLOAD',
    'EXECUTE',
    'LOGIN',
    'LOGOUT',
    'PERMISSION_CHANGE',
  ];

  return auditActions.some((auditAction) => action.includes(auditAction));
}
