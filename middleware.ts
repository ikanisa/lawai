import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdmin = token?.role === 'ADMIN';
    const isStaff = token?.role === 'STAFF';

    // Admin routes
    if (req.nextUrl.pathname.startsWith('/dashboard') || 
        req.nextUrl.pathname.startsWith('/users') ||
        req.nextUrl.pathname.startsWith('/logs') ||
        req.nextUrl.pathname.startsWith('/settings')) {
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/chat', req.url));
      }
    }

    // Staff routes
    if (req.nextUrl.pathname.startsWith('/chat') ||
        req.nextUrl.pathname.startsWith('/documents') ||
        req.nextUrl.pathname.startsWith('/history')) {
      if (!isStaff && !isAdmin) {
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
