'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  DEMO_ORG_ID,
  acknowledgeCompliance,
  fetchComplianceStatus,
  type ComplianceAcknowledgements,
} from '../lib/api';
import type { Messages } from '../lib/i18n';

interface ComplianceBannerProps {
  messages: Messages['app']['compliance'];
}

export function ComplianceBanner({ messages }: ComplianceBannerProps) {
  const statusQuery = useQuery({
    queryKey: ['compliance-status', DEMO_ORG_ID],
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

  const hasPending = Boolean(pending.consent || pending.council);

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

  if (statusQuery.isLoading) {
    return (
      <div className="mb-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-5 text-sm text-amber-100">
        {messages.loading}
      </div>
    );
  }

  if (!hasPending) {
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
        className="bg-amber-400 text-slate-900 hover:bg-amber-300"
      >
        {messages.acknowledge}
      </Button>
      <p className="text-xs text-amber-100/70">{messages.footer}</p>
    </div>
  );
}
