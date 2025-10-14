import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ComplianceAssessment } from '../../lib/api';
import type { Messages } from '../../lib/i18n';
import { cn } from '../../lib/utils';

interface ComplianceAlertsProps {
  compliance: ComplianceAssessment | null | undefined;
  messages: Messages['research']['compliance'];
}

type Severity = 'warning' | 'critical' | 'success';

type AlertItem = {
  key: string;
  severity: Severity;
  title: string;
  details: string[];
};

const severityPalette: Record<Severity, string> = {
  warning: 'border-legal-amber/40 bg-legal-amber/10 text-legal-amber',
  critical: 'border-legal-red/40 bg-legal-red/10 text-legal-red',
  success: 'border-legal-green/40 bg-legal-green/10 text-legal-green',
};

const iconBySeverity: Record<Severity, typeof ShieldCheck> = {
  warning: AlertTriangle,
  critical: ShieldAlert,
  success: ShieldCheck,
};

export function ComplianceAlerts({ compliance, messages }: ComplianceAlertsProps) {
  if (!compliance || !messages) {
    return null;
  }

  const cepejMessages = messages.cepejViolations ?? {};
  const statuteMessages = messages.statuteViolations ?? {};
  const disclosureMessages = messages.disclosuresMissing ?? {};

  const alerts: AlertItem[] = [];

  if (compliance.fria.required) {
    const reasons = compliance.fria.reasons.length > 0
      ? compliance.fria.reasons
      : [messages.friaReasonFallback ?? ''];
    alerts.push({
      key: 'fria',
      severity: 'warning',
      title: messages.friaRequired,
      details: reasons.filter((reason) => reason && reason.length > 0),
    });
  }

  if (!compliance.cepej.passed) {
    const details = compliance.cepej.violations.length > 0
      ? compliance.cepej.violations.map((code) => cepejMessages[code] ?? code)
      : [messages.cepejDefaultDetail ?? ''];
    alerts.push({
      key: 'cepej',
      severity: 'warning',
      title: messages.cepejFailed,
      details: details.filter((detail) => detail && detail.length > 0),
    });
  }

  if (!compliance.statute.passed) {
    const details = compliance.statute.violations.length > 0
      ? compliance.statute.violations.map((code) => statuteMessages[code] ?? code)
      : [messages.statuteDefaultDetail ?? ''];
    alerts.push({
      key: 'statute',
      severity: 'critical',
      title: messages.statuteFailed,
      details: details.filter((detail) => detail && detail.length > 0),
    });
  }

  if (compliance.disclosures.missing.length > 0) {
    const details = compliance.disclosures.missing.map((code) => disclosureMessages[code] ?? code);
    alerts.push({
      key: 'disclosures',
      severity: 'critical',
      title: messages.disclosuresRequired,
      details: details.filter((detail) => detail && detail.length > 0),
    });
  }

  const hasIssues = alerts.length > 0;
  const IconSuccess = iconBySeverity.success;

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{messages.title}</p>
        {messages.description ? (
          <p className="text-sm text-slate-400">{messages.description}</p>
        ) : null}
      </div>
      {hasIssues ? (
        alerts.map((alert) => {
          const Icon = iconBySeverity[alert.severity];
          return (
            <div
              key={alert.key}
              className={cn(
                'glass-card flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg',
                severityPalette[alert.severity],
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{alert.title}</p>
                {alert.details.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200/80">
                    {alert.details.map((detail, index) => (
                      <li key={`${alert.key}-${index}`}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          );
        })
      ) : (
        <div
          className={cn(
            'glass-card flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg',
            severityPalette.success,
          )}
        >
          <IconSuccess className="mt-0.5 h-5 w-5" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold">{messages.resolved}</p>
            {messages.resolvedDetail ? (
              <p className="text-sm text-slate-200/80">{messages.resolvedDetail}</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
