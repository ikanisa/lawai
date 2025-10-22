import type { ReactNode } from 'react';

import { AppProviders } from '../../src/components/providers';
import { getServerAuthSession } from '../../src/server/auth/session';
import type { SessionPayload } from '../../src/types/session';

export async function SessionHydrator({ children }: { children: ReactNode }) {
  const sessionResult = await getServerAuthSession();
  let initialSession: SessionPayload | null = null;

  if (sessionResult.session && sessionResult.hasRealIdentity && sessionResult.orgId && sessionResult.userId) {
    initialSession = {
      session: { orgId: sessionResult.orgId, userId: sessionResult.userId },
      isDemo: sessionResult.isDemo,
    } satisfies SessionPayload;
  }

  return <AppProviders initialSession={initialSession}>{children}</AppProviders>;
}
