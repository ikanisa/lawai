'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  acknowledgeCompliance,
  fetchComplianceStatus,
  type ComplianceAcknowledgements,
} from '../lib/api';
import type { Messages } from '../lib/i18n';
import { useSession } from '@avocat-ai/auth';

interface ComplianceBannerProps {
  messages: Messages['app']['compliance'];
}

export function ComplianceBanner({ messages }: ComplianceBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const { status: sessionStatus, session } = useSession();

  const orgId = session?.orgId;
  const userId = session?.userId;
  const canQuery = sessionStatus === 'authenticated' && Boolean(orgId && userId);

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
    queryKey: ['compliance-status', orgId, userId],
    queryFn: () => {
      if (!orgId) throw new Error('missing_org');
      return fetchComplianceStatus(orgId, { userId });
    },
    enabled: canQuery,
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
      if (!orgId) {
        throw new Error('missing_org');
      }
      return acknowledgeCompliance(orgId, { ...payload, userId });
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

  if (!canQuery) {
    if (sessionStatus === 'loading') {
      return (
        <div
          className="mb-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-5 text-sm text-amber-100"
          role="status"
          aria-live="polite"
        >
          {messages.loading}
        </div>
      );
    }
    return null;
  }

  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  if (statusQuery.isLoading) {
    return (
      <div
        className="mb-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-5 text-sm text-amber-100"
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
        className="mb-6 space-y-4 rounded-3xl border border-amber-400/80 bg-amber-500/10 p-5 text-sm text-amber-100 shadow-lg"
        role="alert"
        aria-live="assertive"
      >
        <div>
          <h3 className="text-base font-semibold text-amber-100">{messages.errorTitle}</h3>
          <p className="mt-1 text-amber-100/80">{isOffline ? messages.offline : messages.error}</p>
        </div>
        <Button
          size="sm"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isRefetching}
          className="bg-amber-400 text-slate-900 hover:bg-amber-300"
        >
          {messages.retry}
        </Button>
      </div>
    );
  }

  if (!hasPending && isSuccess) {
    return (
      <div
        className="mb-6 rounded-3xl border border-emerald-400/70 bg-emerald-500/10 p-5 text-sm text-emerald-50 shadow-lg"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-base font-semibold text-emerald-100">{messages.clearTitle}</h3>
        <p className="mt-1 text-emerald-100/80">{messages.clearDescription}</p>
      </div>
    );
  }

  if (!messages) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4 rounded-3xl border border-amber-400/80 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-lg">
      <div>
        <h3 className="text-base font-semibold text-amber-100">{messages.title}</h3>
        <p className="mt-1 text-amber-100/80">{messages.description}</p>
      </div>
      <ul className="space-y-2 text-amber-100">
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
        className="bg-amber-400 text-slate-900 hover:bg-amber-300"
      >
        {messages.acknowledge}
      </Button>
      <p className="text-xs text-amber-100/70">{messages.footer}</p>
    </div>
  );
}
