import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { logAuditEvent, getClientIP, getUserAgent } from './middleware/audit';

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const isAdmin = token?.role === 'ADMIN';
    const isStaff = token?.role === 'STAFF';

    // Log access attempts
    if (token?.sub) {
      await logAuditEvent({
        userId: token.sub,
        action: `ACCESS_${req.method}_${req.nextUrl.pathname}`,
        resourceType: 'route',
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        metadata: {
          path: req.nextUrl.pathname,
          method: req.method,
          role: token.role,
        },
      });
    }

    // Admin routes
    if (req.nextUrl.pathname.startsWith('/dashboard') || 
        req.nextUrl.pathname.startsWith('/users') ||
        req.nextUrl.pathname.startsWith('/logs') ||
        req.nextUrl.pathname.startsWith('/settings')) {
      if (!isAdmin) {
        if (token?.sub) {
          await logAuditEvent({
            userId: token.sub,
            action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            resourceType: 'route',
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req),
            metadata: {
              path: req.nextUrl.pathname,
              attemptedRole: token.role,
              requiredRole: 'ADMIN',
            },
          });
        }
        return NextResponse.redirect(new URL('/chat', req.url));
      }
    }

    // Staff routes
    if (req.nextUrl.pathname.startsWith('/chat') ||
        req.nextUrl.pathname.startsWith('/documents') ||
        req.nextUrl.pathname.startsWith('/history') ||
        req.nextUrl.pathname.startsWith('/matters') ||
        req.nextUrl.pathname.startsWith('/vaults') ||
        req.nextUrl.pathname.startsWith('/workflows')) {
      if (!isStaff && !isAdmin) {
        if (token?.sub) {
          await logAuditEvent({
            userId: token.sub,
            action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            resourceType: 'route',
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req),
            metadata: {
              path: req.nextUrl.pathname,
              attemptedRole: token.role,
              requiredRole: 'STAFF',
            },
          });
        }
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
