import { useState } from 'react';
import { IRACPayload } from '@avocat-ai/shared';
import { Clipboard, Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

interface IRACAccordionProps {
  payload: IRACPayload;
  labels: {
    issue: string;
    rules: string;
    application: string;
    conclusion: string;
  };
  onCopy?: () => void;
  onExportPdf?: () => void | Promise<void>;
  onExportDocx?: () => void | Promise<void>;
  copyLabel: string;
  exportPdfLabel: string;
  exportDocxLabel: string;
  contentClassName?: string;
}

export function IRACAccordion({
  payload,
  labels,
  onCopy,
  onExportPdf,
  onExportDocx,
  copyLabel,
  exportPdfLabel,
  exportDocxLabel,
  contentClassName,
}: IRACAccordionProps) {
  const [pendingExport, setPendingExport] = useState<'pdf' | 'docx' | null>(null);

  async function handleExport(type: 'pdf' | 'docx', handler?: () => void | Promise<void>) {
    if (!handler) return;
    try {
      setPendingExport(type);
      await handler();
    } finally {
      setPendingExport((current) => (current === type ? null : current));
    }
  }

  const sections: Array<{ key: keyof IRACPayload; label: string; content: string | IRACPayload['rules'] }> = [
    { key: 'issue', label: labels.issue, content: payload.issue },
    { key: 'rules', label: labels.rules, content: payload.rules },
    { key: 'application', label: labels.application, content: payload.application },
    { key: 'conclusion', label: labels.conclusion, content: payload.conclusion },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCopy} aria-label={copyLabel}>
          <Clipboard className="h-4 w-4" aria-hidden /> {copyLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport('pdf', onExportPdf)}
          aria-label={exportPdfLabel}
          disabled={pendingExport !== null}
        >
          {pendingExport === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {exportPdfLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport('docx', onExportDocx)}
          aria-label={exportDocxLabel}
          disabled={pendingExport !== null}
        >
          {pendingExport === 'docx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {exportDocxLabel}
        </Button>
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <details
            key={section.key as string}
            className="group rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 transition hover:border-slate-500/60"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">{section.label}</span>
              <span className="text-xs text-slate-400 transition group-open:rotate-180">▼</span>
            </summary>
            <div className={cn('mt-3 space-y-3 text-sm text-slate-200/90', contentClassName)}>
              {section.key === 'rules' && Array.isArray(section.content) ? (
                <ol className={cn('list-decimal space-y-2 pl-5', contentClassName)}>
                  {section.content.map((rule, index) => (
                    <li key={`${rule.citation}-${index}`} className="leading-relaxed">
                      <p className="font-semibold text-slate-100">{rule.citation}</p>
                      <p className="text-slate-300/90">{rule.source_url}</p>
                      <p className="text-xs text-slate-400">{rule.effective_date}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={cn('leading-relaxed whitespace-pre-line', contentClassName)}>{String(section.content)}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
