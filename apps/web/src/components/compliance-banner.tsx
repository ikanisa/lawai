import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { TrustPanelComplianceSummary } from '../lib/api';
import type { Messages } from '../lib/i18n';
import { cn } from '../lib/utils';

interface ComplianceBannerProps {
  compliance: TrustPanelComplianceSummary | null | undefined;
  messages: Messages['research']['compliance'];
}

export function ComplianceBanner({ compliance, messages }: ComplianceBannerProps) {
  if (!messages) {
    return null;
  }

  const issues: string[] = [];
  const cepejMessages = messages.cepejViolations ?? {};
  const statuteMessages = messages.statuteViolations ?? {};
  const disclosureMessages = messages.disclosuresMissing ?? {};

  if (compliance) {
    if (compliance.fria.required) {
      const reason = compliance.fria.reasons[0] ?? messages.friaReasonFallback;
      issues.push(messages.friaRequired + (reason ? ` — ${reason}` : ''));
    }

    if (!compliance.cepej.passed) {
      const detail =
        compliance.cepej.violations.length > 0
          ? compliance.cepej.violations
              .map((code) => cepejMessages[code as keyof typeof cepejMessages] ?? code)
              .join(', ')
          : messages.cepejDefaultDetail;
      issues.push(messages.cepejFailed + (detail ? ` — ${detail}` : ''));
    }

    if (!compliance.statute.passed) {
      const detail =
        compliance.statute.violations.length > 0
          ? compliance.statute.violations
              .map((code) => statuteMessages[code as keyof typeof statuteMessages] ?? code)
              .join(', ')
          : messages.statuteDefaultDetail;
      issues.push(messages.statuteFailed + (detail ? ` — ${detail}` : ''));
    }

    const disclosurePending =
      compliance.disclosures.missing.length > 0 ||
      !compliance.disclosures.consentSatisfied ||
      !compliance.disclosures.councilSatisfied;
    if (disclosurePending) {
      const detail =
        compliance.disclosures.missing.length > 0
          ? compliance.disclosures.missing
              .map((code) => disclosureMessages[code as keyof typeof disclosureMessages] ?? code)
              .join(', ')
          : null;
      issues.push(messages.disclosuresRequired + (detail ? ` — ${detail}` : ''));
    }
  }

  const hasIssues = issues.length > 0;
  const consentVersion = compliance?.disclosures.requiredConsentVersion ?? null;
  const councilVersion = compliance?.disclosures.requiredCoeVersion ?? null;

  const consentLine = consentVersion
    ? compliance?.disclosures.consentSatisfied
      ? messages.consentAcknowledged?.replace('{version}', consentVersion)
      : messages.consentPending?.replace('{version}', consentVersion)
    : null;

  const councilLine = councilVersion
    ? compliance?.disclosures.councilSatisfied
      ? messages.councilAcknowledged?.replace('{version}', councilVersion)
      : messages.councilPending?.replace('{version}', councilVersion)
    : null;

  const acknowledgementLines = [consentLine, councilLine].filter(Boolean);

  return (
    <div
      className={cn(
        'glass-card rounded-2xl border px-4 py-3 shadow-lg',
        hasIssues
          ? 'border-legal-amber/50 bg-legal-amber/10 text-legal-amber'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {hasIssues ? (
          <AlertTriangle className="mt-1 h-5 w-5" aria-hidden />
        ) : (
          <ShieldCheck className="mt-1 h-5 w-5" aria-hidden />
        )}
        <div className="space-y-2 text-sm">
          <div>
            <p className="font-semibold text-slate-100">{messages.title}</p>
            <p className="text-xs text-slate-300">{messages.description}</p>
          </div>
          {hasIssues ? (
            <ul className="space-y-1 text-xs text-slate-200">
              {issues.map((issue) => (
                <li key={issue} className="list-inside list-disc">
                  {issue}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-slate-200">
              <p>{messages.resolved}</p>
              <p className="text-slate-400">{messages.resolvedDetail}</p>
            </div>
          )}
          {acknowledgementLines.length > 0 ? (
            <div className="space-y-1 text-xs text-slate-200">
              {acknowledgementLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
