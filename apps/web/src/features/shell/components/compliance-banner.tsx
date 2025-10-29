'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/ui/button';
import {
  DEMO_ORG_ID,
  acknowledgeCompliance,
  fetchComplianceStatus,
  type ComplianceAcknowledgements,
} from '@/lib/api';
import { queryKeys } from '@/lib/query';
import type { Messages } from '@/lib/i18n';

interface ComplianceBannerProps {
  messages: Messages['app']['compliance'];
}

export function ComplianceBanner({ messages }: ComplianceBannerProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function syncStatus() {
      if (typeof navigator === 'undefined') return;
      setIsOffline(!navigator.onLine);
    }

    if (typeof window === 'undefined') {
      return () => {};
    }

    syncStatus();
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);
    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  const statusQuery = useQuery({
    queryKey: queryKeys.compliance(DEMO_ORG_ID),
    queryFn: () => fetchComplianceStatus(DEMO_ORG_ID),
    staleTime: 5 * 60 * 1000,
  });

  const acknowledgements = statusQuery.data?.acknowledgements as ComplianceAcknowledgements | undefined;

  const pending = useMemo(() => {
    const consentPending =
      acknowledgements?.consent.requiredVersion && !acknowledgements.consent.satisfied
        ? {
            version: acknowledgements.consent.requiredVersion,
            type: 'ai_assist' as const,
          }
        : null;

    const councilPending =
      acknowledgements?.councilOfEurope.requiredVersion && !acknowledgements.councilOfEurope.satisfied
        ? { version: acknowledgements.councilOfEurope.requiredVersion }
        : null;

    return { consent: consentPending, council: councilPending } as const;
  }, [acknowledgements]);

  const ackMutation = useMutation({
    mutationFn: async () => {
      const payload: {
        consent?: { type: string; version: string };
        councilOfEurope?: { version: string };
      } = {};
      if (pending.consent) {
        payload.consent = { type: pending.consent.type, version: pending.consent.version };
      }
      if (pending.council) {
        payload.councilOfEurope = { version: pending.council.version };
      }
      if (!payload.consent && !payload.councilOfEurope) {
        return null;
      }
      return acknowledgeCompliance(DEMO_ORG_ID, payload);
    },
    onSuccess: () => {
      toast.success(messages.acknowledged);
      void statusQuery.refetch();
    },
    onError: () => {
      toast.error(messages.error);
    },
  });

  const hasPending = Boolean(pending.consent || pending.council);
  const isError = statusQuery.isError;
  const isSuccess = statusQuery.isSuccess;

  if (statusQuery.isLoading) {
    return (
      <div
        className="mb-6 rounded-3xl border border-warning/60 bg-warning/10 p-5 text-sm text-warning-foreground"
        role="status"
        aria-live="polite"
      >
        {messages.loading}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="mb-6 space-y-4 rounded-3xl border border-warning/80 bg-warning/10 p-5 text-sm text-warning-foreground shadow-lg"
        role="alert"
        aria-live="assertive"
      >
        <div>
          <h3 className="text-base font-semibold text-warning-foreground">{messages.errorTitle}</h3>
          <p className="mt-1 text-sm text-warning-foreground/80">{isOffline ? messages.offline : messages.error}</p>
        </div>
        <Button
          size="sm"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isRefetching}
          variant="outline"
          className="border-warning/60 text-warning-foreground hover:bg-warning/20"
        >
          {messages.retry}
        </Button>
      </div>
    );
  }

  if (!hasPending && isSuccess) {
    return (
      <div
        className="mb-6 rounded-3xl border border-success/60 bg-success/10 p-5 text-sm text-success-foreground shadow-lg"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-base font-semibold text-success-foreground">{messages.clearTitle}</h3>
        <p className="mt-1 text-sm text-success-foreground/80">{messages.clearDescription}</p>
      </div>
    );
  }

  if (!messages) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4 rounded-3xl border border-warning/80 bg-warning/10 p-5 text-sm text-warning-foreground shadow-lg">
      <div>
        <h3 className="text-base font-semibold text-warning-foreground">{messages.title}</h3>
        <p className="mt-1 text-sm text-warning-foreground/80">{messages.description}</p>
      </div>
      <ul className="space-y-2 text-warning-foreground">
        {pending.consent ? (
          <li>{messages.consentRequired.replace('{version}', pending.consent.version)}</li>
        ) : null}
        {pending.council ? (
          <li>{messages.councilRequired.replace('{version}', pending.council.version)}</li>
        ) : null}
      </ul>
      <Button
        size="sm"
        onClick={() => ackMutation.mutate()}
        disabled={ackMutation.isLoading}
        aria-busy={ackMutation.isLoading}
        variant="outline"
        className="border-warning/60 text-warning-foreground hover:bg-warning/20"
      >
        {messages.acknowledge}
      </Button>
      <p className="text-xs text-warning-foreground/70">{messages.footer}</p>
    </div>
  );
}
