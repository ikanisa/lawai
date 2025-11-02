import type { IRACPayload } from '@avocat-ai/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';

import { RiskBanner } from '@/components/risk-banner';
import { LanguageBanner } from '@/components/language-banner';
import { BilingualToggle } from '@/components/bilingual-toggle';
import { IRACAccordion } from '@/components/irac-accordion';
import { CitationCard } from '@/components/citation-card';
import type { Messages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { RwandaLanguageTriage } from './rwanda-language-triage';
import type { ReadingMode } from './reading-mode-toggle';

export interface TrustSummary {
  verificationMessage: string;
  verificationNotes: Array<{ code: string; message: string }>;
  allowlistSummary: string;
  allowlistDetails: string[];
  allowlistStats: string | null;
  translationSummary: string;
  translationWarnings: string[];
  bindingSummary: string;
  bindingCountsMessage: string | null;
  planSummary: string | null;
  riskLabelSummary: string | null;
  hitlSummary: string | null;
  citationHosts: Array<{ host: string; count: number }>;
}

export interface ResearchResultsPaneProps {
  payload: IRACPayload | null;
  readingMode: ReadingMode;
  researchMessages: Messages['research'];
  confidentialMode: boolean;
  confidentialBanner?: string | null;
  isMaghreb: boolean;
  isCanadian: boolean;
  isSwiss: boolean;
  isRwanda: boolean;
  noticeMessages: string[];
  hitlButtonLabel: string;
  hitlButtonDisabled: boolean;
  onHitlRequest: () => void;
  onBilingualSelect: (language: 'fr' | 'en') => void;
  onRwandaLanguageSelect: (language: 'fr' | 'en' | 'rw') => void;
  citationBadges: (note?: string) => string[];
  verifyLabel: string;
  staleLabel: string;
  isCitationStale: (date: string) => boolean;
  onCitationVisit: (url: string) => void;
  onCitationVerify: (url: string) => void;
  hyphenatedClass?: string;
  trustSummary: TrustSummary;
  awaiting: { title: string; body: string; secondary: string };
  exportLabels: { copy: string; exportPdf: string; exportDocx: string };
  onExportPdf: () => Promise<void> | void;
  onExportDocx: () => Promise<void> | void;
}

interface BriefSummaryProps {
  payload: IRACPayload;
  readingMessages: Messages['research']['readingModes'];
  textClassName?: string;
}

function BriefSummary({ payload, readingMessages, textClassName }: BriefSummaryProps) {
  const leadingRules = payload.rules?.slice(0, 3) ?? [];

  return (
    <Card className="font-serif">
      <CardHeader>
        <CardTitle className="text-xl text-slate-100">{readingMessages.briefTitle}</CardTitle>
        <p className="text-sm text-slate-300">{readingMessages.briefLead}</p>
      </CardHeader>
      <CardContent className={cn('space-y-4 text-lg leading-relaxed text-slate-100', textClassName)}>
        <section>
          <h3 className="text-base font-semibold uppercase tracking-wide text-slate-300">
            {readingMessages.briefIssue}
          </h3>
          <p className="mt-1">{payload.issue}</p>
        </section>

        <section>
          <h3 className="text-base font-semibold uppercase tracking-wide text-slate-300">
            {readingMessages.briefConclusion}
          </h3>
          <p className="mt-1">{payload.conclusion}</p>
        </section>

        <section>
          <h3 className="text-base font-semibold uppercase tracking-wide text-slate-300">
            {readingMessages.briefRules}
          </h3>
          {leadingRules.length > 0 ? (
            <ul className="mt-1 space-y-2 text-base leading-relaxed">
              {leadingRules.map((rule, index) => (
                <li key={`${rule.citation}-${index}`}>
                  <span className="font-semibold text-slate-200">{rule.citation}</span>
                  {rule.effective_date ? (
                    <span className="text-sm text-slate-400"> · {rule.effective_date}</span>
                  ) : null}
                  <div className="text-sm text-slate-300">{rule.summary ?? rule.note}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-base text-slate-300">{readingMessages.briefRulesEmpty}</p>
          )}
        </section>

        <section>
          <h3 className="text-base font-semibold uppercase tracking-wide text-slate-300">
            {readingMessages.briefApplication}
          </h3>
          <p className="mt-1">{payload.application}</p>
        </section>
      </CardContent>
    </Card>
  );
}

interface EvidenceFocusProps {
  citations?: IRACPayload['citations'];
  readingMessages: Messages['research']['readingModes'];
  onVisit: (url: string) => void;
  citationBadges: (note?: string) => string[];
  verifyLabel: string;
  staleLabel: string;
  isCitationStale: (date: string) => boolean;
  onVerify: (url: string) => void;
  textClassName?: string;
}

function EvidenceFocusCard({
  citations = [],
  readingMessages,
  onVisit,
  citationBadges,
  verifyLabel,
  staleLabel,
  isCitationStale,
  onVerify,
  textClassName,
}: EvidenceFocusProps) {
  const primary = citations[0];
  const secondary = citations.slice(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{readingMessages.evidenceModeTitle}</CardTitle>
        <p className="text-sm text-slate-300">{readingMessages.evidenceModeSubtitle}</p>
      </CardHeader>
      <CardContent className={cn('space-y-4', textClassName)}>
        {primary ? (
          <article className={cn('glass-card space-y-3 rounded-2xl border border-slate-700/60 p-4', textClassName)}>
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {readingMessages.evidencePrimary}
              </p>
              <h4 className="text-sm font-semibold text-slate-100">{primary.title}</h4>
              <p className="text-xs text-slate-400">
                {primary.court_or_publisher} · {primary.date}
              </p>
            </header>
            <div className="flex flex-wrap items-center gap-2">
              {citationBadges(primary.note).map((badge) => (
                <Badge key={badge} variant={badge === 'Officiel' ? 'success' : 'outline'}>
                  {badge}
                </Badge>
              ))}
              {isCitationStale(primary.date ?? '') ? (
                <Badge variant="warning">{staleLabel}</Badge>
              ) : null}
            </div>
            {primary.note ? <p className="text-xs text-slate-300">{primary.note}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onVisit(primary.url)}>
                {readingMessages.evidenceOpen}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onVerify(primary.url)}>
                {verifyLabel}
              </Button>
            </div>
          </article>
        ) : (
          <p className="text-sm text-slate-300">{readingMessages.evidenceEmpty}</p>
        )}

        {secondary.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {readingMessages.evidenceSecondary}
            </p>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {secondary.map((citation) => (
                <li key={citation.url}>
                  <button
                    type="button"
                    onClick={() => onVisit(citation.url)}
                    className="text-left text-indigo-300 underline-offset-4 hover:underline"
                  >
                    {citation.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ResearchResultsPane({
  payload,
  readingMode,
  researchMessages,
  confidentialMode,
  confidentialBanner,
  isMaghreb,
  isCanadian,
  isSwiss,
  isRwanda,
  noticeMessages,
  hitlButtonLabel,
  hitlButtonDisabled,
  onHitlRequest,
  onBilingualSelect,
  onRwandaLanguageSelect,
  citationBadges,
  verifyLabel,
  staleLabel,
  isCitationStale,
  onCitationVisit,
  onCitationVerify,
  hyphenatedClass,
  trustSummary,
  awaiting,
  exportLabels,
  onExportPdf,
  onExportDocx,
}: ResearchResultsPaneProps) {
  const readingModeMessages = researchMessages.readingModes;
  const trustMessages = researchMessages.trust;
  const bilingualMessages = researchMessages.bilingual;
  const rwandaMessages = researchMessages.rwanda;

  if (!payload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{awaiting.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <p>{awaiting.body}</p>
          <p>{awaiting.secondary}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <RiskBanner
        risk={payload.risk}
        hitlLabel={hitlButtonLabel}
        onHitl={onHitlRequest}
        hitlDisabled={hitlButtonDisabled}
      />
      {confidentialMode && confidentialBanner ? <LanguageBanner message={confidentialBanner} /> : null}
      {isMaghreb ? <LanguageBanner message={researchMessages.languageWarning} /> : null}
      {isCanadian ? <LanguageBanner message={researchMessages.canadaLanguageNotice} /> : null}
      {isSwiss ? <LanguageBanner message={researchMessages.switzerlandLanguageNotice} /> : null}
      {isRwanda && researchMessages.rwandaLanguageNotice ? (
        <LanguageBanner message={researchMessages.rwandaLanguageNotice} />
      ) : null}
      {noticeMessages.map((message) => (
        <LanguageBanner key={message} message={message} />
      ))}
      {isCanadian ? (
        <BilingualToggle messages={bilingualMessages} onSelect={onBilingualSelect} />
      ) : null}
      {isRwanda && rwandaMessages ? (
        <RwandaLanguageTriage messages={rwandaMessages} onSelect={onRwandaLanguageSelect} />
      ) : null}
      {readingMode === 'research' ? (
        <IRACAccordion
          payload={payload}
          labels={researchMessages.irac}
          onCopy={() => navigator.clipboard.writeText(JSON.stringify(payload, null, 2))}
          onExportPdf={onExportPdf}
          onExportDocx={onExportDocx}
          copyLabel={exportLabels.copy}
          exportPdfLabel={exportLabels.exportPdf}
          exportDocxLabel={exportLabels.exportDocx}
          contentClassName={hyphenatedClass}
        />
      ) : readingMode === 'brief' ? (
        <BriefSummary
          payload={payload}
          readingMessages={readingModeMessages}
          textClassName={hyphenatedClass}
        />
      ) : (
        <EvidenceFocusCard
          citations={payload.citations}
          readingMessages={readingModeMessages}
          onVisit={onCitationVisit}
          citationBadges={citationBadges}
          verifyLabel={verifyLabel}
          staleLabel={staleLabel}
          isCitationStale={isCitationStale}
          onVerify={onCitationVerify}
          textClassName={hyphenatedClass}
        />
      )}

      {readingMode !== 'evidence' ? (
        <Card>
          <CardHeader>
            <CardTitle>{trustMessages.title}</CardTitle>
            <p className="text-sm text-slate-300">{trustMessages.description}</p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-200">
            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.verificationHeading}</h4>
              <p className="mt-1">{trustSummary.verificationMessage}</p>
              {trustSummary.verificationNotes.length > 0 ? (
                <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                  {trustSummary.verificationNotes.map((note) => (
                    <li key={`${note.code}-${note.message}`}>{note.message}</li>
                  ))}
                </ul>
              ) : null}
              {trustSummary.allowlistStats ? (
                <p className="mt-2 text-xs text-slate-400">{trustSummary.allowlistStats}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">{trustSummary.allowlistSummary}</p>
              {trustSummary.allowlistDetails.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {trustSummary.allowlistDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.translationHeading}</h4>
              <p className="mt-1">{trustSummary.translationSummary}</p>
              {trustSummary.translationWarnings.length > 0 ? (
                <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                  {trustSummary.translationWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.bindingHeading}</h4>
              <p className="mt-1">{trustSummary.bindingSummary}</p>
              {trustSummary.bindingCountsMessage ? (
                <p className="mt-1 text-xs text-slate-400">{trustSummary.bindingCountsMessage}</p>
              ) : null}
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.sourcesHeading}</h4>
              {trustSummary.citationHosts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-slate-300">
                  {trustSummary.citationHosts.map(({ host, count }) => {
                    const template = count === 1 ? trustMessages.sourceHostSingle : trustMessages.sourceHostMultiple;
                    const label = template
                      .replace('{host}', host)
                      .replace('{count}', count.toString());
                    return <li key={`${host}-${count}`}>{label}</li>;
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-slate-400">{trustMessages.sourcesEmpty}</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.planHeading}</h4>
              {trustSummary.planSummary ? <p className="mt-1">{trustSummary.planSummary}</p> : null}
              {trustSummary.riskLabelSummary ? (
                <p className="mt-1">{trustSummary.riskLabelSummary}</p>
              ) : null}
              {trustSummary.hitlSummary ? (
                <p className={`mt-1 ${payload.risk.hitl_required ? 'text-amber-300' : ''}`}>
                  {trustSummary.hitlSummary}
                </p>
              ) : null}
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{trustMessages.noticesHeading}</h4>
              {noticeMessages.length > 0 ? (
                <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                  {noticeMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-400">{trustMessages.noticesEmpty}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
