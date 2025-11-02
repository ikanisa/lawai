'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import type { Locale } from '@/lib/i18n';
import { clientEnv } from '@/env.client';
import { Spinner } from '@avocat-ai/ui';

const AUTH_ROUTE_SEGMENT = '/auth';

function createBrowserClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
    },
  });
}

const cachedClient = createBrowserClient();

export interface AuthGuardProps {
  children: ReactNode;
  locale: Locale;
}

type GuardState = 'checking' | 'authenticated' | 'unauthenticated';

export function AuthGuard({ children, locale }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<GuardState>('checking');

  const isAuthRoute = useMemo(() => pathname?.includes(`/${locale}${AUTH_ROUTE_SEGMENT}`) ?? false, [locale, pathname]);

  useEffect(() => {
    if (isAuthRoute) {
      setStatus('authenticated');
      return;
    }

    let active = true;

    cachedClient.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setStatus(data.session ? 'authenticated' : 'unauthenticated');
        if (!data.session) {
          const search = new URLSearchParams();
          if (pathname) {
            search.set('redirect', pathname);
          }
          router.replace(`/${locale}${AUTH_ROUTE_SEGMENT}?${search.toString()}`);
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus('unauthenticated');
        const search = new URLSearchParams();
        if (pathname) {
          search.set('redirect', pathname);
        }
        router.replace(`/${locale}${AUTH_ROUTE_SEGMENT}?${search.toString()}`);
      });

    const { data: subscription } = cachedClient.auth.onAuthStateChange((_event, session) => {
      if (!active || isAuthRoute) return;
      setStatus(session ? 'authenticated' : 'unauthenticated');
      if (!session) {
        router.replace(`/${locale}${AUTH_ROUTE_SEGMENT}`);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [isAuthRoute, locale, pathname, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Verifying access" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
