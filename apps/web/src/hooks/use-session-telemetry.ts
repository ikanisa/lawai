'use client';

import { useCallback } from 'react';
import { sendTelemetryEvent } from '@/lib/api';
import { useRequiredSession } from '@avocat-ai/auth';

export function useSessionTelemetry() {
  const { orgId, userId } = useRequiredSession();

  return useCallback(
    (eventName: string, payload?: Record<string, unknown>) => {
      if (!orgId || !userId) {
        return;
      }
      void sendTelemetryEvent(eventName, payload, orgId, userId);
    },
    [orgId, userId],
  );
}
