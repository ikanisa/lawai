'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ExternalLink, Loader2, Check } from 'lucide-react';
import { DEMO_ORG_ID, acknowledgeCompliance, fetchComplianceStatus, type ComplianceStatusResponse } from '../lib/api';
import type { Messages } from '../lib/i18n';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ComplianceBannerProps {
  messages?: Messages['app']['compliance'];
}

export function ComplianceBanner({ messages }: ComplianceBannerProps) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery<ComplianceStatusResponse>({
    queryKey: ['compliance-status', DEMO_ORG_ID],
    queryFn: () => fetchComplianceStatus(DEMO_ORG_ID),
    staleTime: 60_000,
  });

  const summary = statusQuery.data?.compliance ?? null;
  const consentRequirement = summary?.consent.requirement ?? null;
  const councilRequirement = summary?.councilOfEurope.requirement ?? null;
  const needsConsent = Boolean(consentRequirement) && summary?.consent.accepted === false;
  const needsCouncil = Boolean(councilRequirement) && summary?.councilOfEurope.acknowledged === false;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        consent: needsConsent && consentRequirement ? { type: consentRequirement.type, version: consentRequirement.version } : null,
        councilOfEurope:
          needsCouncil && councilRequirement ? { version: councilRequirement.version } : null,
      };
      if (!payload.consent && !payload.councilOfEurope) {
        return statusQuery.data ?? { compliance: summary };
      }
      return acknowledgeCompliance(DEMO_ORG_ID, payload);
    },
    onSuccess: () => {
      toast.success(messages?.acknowledged ?? 'Compliance acknowledged');
      return queryClient.invalidateQueries({ queryKey: ['compliance-status', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages?.error ?? 'Unable to record acknowledgement');
    },
  });

  if (statusQuery.isLoading) {
    return (
      <div className="mb-6 rounded-3xl border border-slate-800/60 bg-slate-900/60 px-5 py-4 text-sm text-slate-300">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
        {messages?.loading ?? 'Checking compliance requirements…'}
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="mb-6 rounded-3xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
        {messages?.error ?? 'Unable to load compliance requirements.'}
      </div>
    );
  }

  if (!needsConsent && !needsCouncil) {
    return null;
  }

  const consentText = needsConsent
    ? (messages?.consentRequired ?? 'Please acknowledge the AI-assist consent (version {version}).').replace(
        '{version}',
        consentRequirement?.version ?? '—',
      )
    : null;

  const councilText = needsCouncil
    ? (messages?.councilRequired ?? 'Please acknowledge the Council of Europe framework (version {version}).').replace(
        '{version}',
        councilRequirement?.version ?? '—',
      )
    : null;

  const acknowledgementDisabled = mutation.isPending;

  return (
    <div
      className={cn(
        'mb-6 rounded-3xl border px-5 py-5 shadow-lg transition',
        'border-amber-500/50 bg-amber-500/15 text-amber-50',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <div className="mt-1">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">
                {messages?.title ?? 'Compliance acknowledgement required'}
              </p>
              <p className="text-sm text-amber-100/90">
                {messages?.description ?? 'Please confirm the required policies before continuing to use the assistant.'}
              </p>
            </div>
            <ul className="space-y-2 text-sm text-amber-50">
              {consentText ? <li>{consentText}</li> : null}
              {councilText ? <li>{councilText}</li> : null}
            </ul>
            {councilRequirement?.documentUrl ? (
              <a
                href={councilRequirement.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-amber-100 underline decoration-amber-200/60 underline-offset-4"
              >
                {messages?.viewDocument ?? 'View policy document'}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2 sm:items-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={acknowledgementDisabled}
            className="w-full sm:w-auto"
            variant="secondary"
          >
            {acknowledgementDisabled ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-2 h-4 w-4" aria-hidden />
            )}
            {messages?.acknowledge ?? 'I acknowledge'}
          </Button>
          <p className="text-xs text-amber-100/70">
            {messages?.footer ?? 'Your acknowledgement is logged for compliance records.'}
          </p>
        </div>
      </div>
    </div>
  );
}
