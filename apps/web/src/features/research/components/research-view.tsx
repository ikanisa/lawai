'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IRACPayload, SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';
import { Switch } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { JurisdictionChip } from '@/components/jurisdiction-chip';
import type { JurisdictionChipProps } from '@/components/jurisdiction-chip';
import { CitationCard } from '@/components/citation-card';
import { VersionTimeline } from '@/components/version-timeline';
import { PlanDrawer } from '@/components/plan-drawer';
import { usePlanDrawer } from '@/state/plan-drawer';
import { OutboxPanel } from './outbox-panel';
import { ReadingModeToggle, type ReadingMode } from './reading-mode-toggle';
import {
  DEMO_ORG_ID,
  DEMO_USER_ID,
  submitResearchQuestion,
  sendTelemetryEvent,
  requestHitlReview,
  type AgentRunResponse,
} from '@/lib/api';
import type { Messages, Locale } from '@/lib/i18n';
import { Badge } from '@avocat-ai/ui';
import { Separator } from '@avocat-ai/ui';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/features/platform/hooks/use-online-status';
import { useOutbox, type OutboxItem } from '@/features/platform/hooks/use-outbox';
import { usePwaInstall } from '@/features/platform/hooks/use-pwa-install';
import { useConfidentialMode } from '@/state/confidential-mode';
import { ResearchQueryForm } from './query-form';
import { ResearchOfflineBanner } from './offline-banner';
import { ResearchResultsPane } from './irac-results-pane';
import { useIracExportActions } from './use-irac-export-actions';

const EMPTY_VIOLATIONS: string[] = [];

interface ResearchViewProps {
  messages: Messages;
  locale: Locale;
}

export function ResearchView({ messages, locale }: ResearchViewProps) {
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [ohadaMode, setOhadaMode] = useState(true);
  const [euOverlay, setEuOverlay] = useState(true);
  const confidentialMode = useConfidentialMode((state) => state.enabled);
  const setConfidentialMode = useConfidentialMode((state) => state.setEnabled);
  const [readingMode, setReadingMode] = useState<ReadingMode>('research');
  const [latestRun, setLatestRun] = useState<AgentRunResponse | null>(null);
  const { open, toggle } = usePlanDrawer();
  const online = useOnlineStatus();
  const { items: outboxItems, enqueue, remove, flush } = useOutbox({ persist: !confidentialMode });
  const [hitlRequestPending, setHitlRequestPending] = useState(false);
  const [hitlQueued, setHitlQueued] = useState(false);

  const badgeMessages = messages.research.badges;
  const readingModeMessages = messages.research.readingModes;
  const readingModeDescriptions = readingModeMessages.descriptions ?? {};
  const confidentialMessages = messages.research.confidential;
  const jurisdictionEntries = useMemo(
    () =>
      SUPPORTED_JURISDICTIONS.map((jurisdiction) => {
        const label = locale === 'fr' ? jurisdiction.labelFr : jurisdiction.labelEn;
        const badges: NonNullable<JurisdictionChipProps['badges']> = [];

        if (jurisdiction.eu) {
          badges.push({ label: badgeMessages.eu, variant: 'outline' });
        }
        if (jurisdiction.ohada) {
          badges.push({ label: badgeMessages.ohada, variant: 'success' });
        }
        if (jurisdiction.bilingual) {
          badges.push({ label: badgeMessages.bilingual, variant: 'warning' });
        }
        if (jurisdiction.triLingual) {
          badges.push({ label: badgeMessages.trilingual, variant: 'warning' });
        }
        if (jurisdiction.maghreb) {
          badges.push({ label: badgeMessages.maghreb, variant: 'warning' });
        }
        if (jurisdiction.notes?.includes('swiss')) {
          badges.push({ label: badgeMessages.swiss, variant: 'outline' });
        }

        return {
          code: jurisdiction.displayCode,
          id: jurisdiction.id,
          label,
          badges,
        };
      }),
    [badgeMessages, locale],
  );

  const successMessage = locale === 'fr' ? 'Analyse prête' : 'Analysis ready';
  const consolidatedMessage = locale === 'fr' ? 'Filtre consolidé activé' : 'Consolidated filter enabled';
  const hitlMessage = locale === 'fr' ? 'Dossier envoyé en revue humaine' : 'Submitted to human review';
  const exportPdfMessage =
    locale === 'fr' ? 'Création de l’archive PDF signée…' : 'Preparing signed PDF archive…';
  const exportDocxMessage =
    locale === 'fr' ? 'Création de l’archive DOCX signée…' : 'Preparing signed DOCX archive…';
  const exportPdfSuccessMessage =
    locale === 'fr'
      ? 'Archive ZIP (PDF + manifeste C2PA) téléchargée.'
      : 'Signed PDF and C2PA manifest bundle downloaded.';
  const exportDocxSuccessMessage =
    locale === 'fr'
      ? 'Archive ZIP (DOCX + manifeste C2PA) téléchargée.'
      : 'Signed DOCX and C2PA manifest bundle downloaded.';
  const exportErrorMessage = locale === 'fr' ? 'Export impossible. Réessayez.' : 'Export failed. Please try again.';
  const opposingMessage =
    locale === 'fr'
      ? 'Le point de vue opposé sera généré après la prochaine itération.'
      : 'The opposing view will be generated on the next run.';
  const contextPlaceholder =
    locale === 'fr' ? 'Contexte supplémentaire (optionnel)' : 'Additional context (optional)';
  const validationMessage =
    locale === 'fr' ? 'Veuillez saisir une question juridique.' : 'Please enter a legal question.';
  const processingLabel = locale === 'fr' ? 'Analyse en cours…' : 'Analyzing…';
  const autoDetectionLabel = locale === 'fr' ? 'Auto détection' : 'Auto detection';
  const ohadaPriorityLabel = locale === 'fr' ? 'OHADA prioritaire' : 'OHADA priority';
  const wcagLabel = locale === 'fr' ? 'WCAG 2.2 conforme' : 'WCAG 2.2 compliant';
  const awaitingTitle = locale === 'fr' ? 'En attente d’une recherche' : 'Awaiting research';
  const awaitingBody =
    locale === 'fr'
      ? 'Soumettez une question juridique pour afficher l’analyse IRAC et les citations officielles.'
      : 'Submit a legal question to view the IRAC analysis and authoritative citations.';
  const awaitingSecondary =
    locale === 'fr'
      ? 'Le plan de l’agent et la revue humaine resteront visibles ici.'
      : 'The agent plan and human review controls will appear here.';
  const citationsEmpty =
    locale === 'fr' ? 'Les citations officielles s’afficheront ici.' : 'Authoritative citations will display here.';
  const timelineEmpty =
    locale === 'fr'
      ? 'La chronologie des versions apparaîtra après la première réponse.'
      : 'The version timeline will appear after the first response.';
  const opposingDescription =
    locale === 'fr'
      ? "Activez le point de vue opposé pour explorer les arguments adverses. L’agent affichera les sources contradictoires et recommandera une revue humaine si nécessaire."
      : 'Enable the opposing view to explore counterarguments. The agent highlights conflicting sources and recommends human review when needed.';
  const opposingButton = locale === 'fr' ? 'Explorer' : 'Explore';
  const planDescription =
    locale === 'fr'
      ? 'Étapes détectées, outils appelés et preuves consultées.'
      : 'Detected steps, invoked tools, and reviewed evidence.';

  const agentUnavailableMessage = locale === 'fr'
    ? 'Agent indisponible. Veuillez réessayer.'
    : 'Agent unavailable. Please try again.';
  const complianceMessages = messages.app.compliance;

  const mutation = useMutation({
    mutationFn: submitResearchQuestion,
    onError: (error: unknown) => {
      const code = error instanceof Error ? error.message : '';
      if (code === 'consent_required' || code === 'coe_disclosure_required') {
        if (complianceMessages?.prompt) {
          toast.warning(complianceMessages.prompt);
        } else {
          toast.warning(agentUnavailableMessage);
        }
        return;
      }
      toast.error(agentUnavailableMessage);
    },
  });
  const { registerSuccess: registerInstallSuccess } = usePwaInstall();

  const payload: IRACPayload | null = latestRun?.data ?? null;
  const jurisdictionCode = payload?.jurisdiction.country;
  const isMaghreb = jurisdictionCode === 'MA' || jurisdictionCode === 'TN' || jurisdictionCode === 'DZ';
  const isCanadian = jurisdictionCode === 'CA-QC' || jurisdictionCode === 'CA';
  const isSwiss = jurisdictionCode === 'CH';
  const isRwanda = jurisdictionCode === 'RW';
  const hyphenatedClass = isRwanda ? 'hyphenate-kinyarwanda' : undefined;

  const planSteps = latestRun?.plan ?? null;
  const planLogs = latestRun?.toolLogs ?? [];
  const planReused = Boolean(latestRun?.reused);
  const runNotices = latestRun?.notices ?? [];
  const noticeMessages = Array.from(new Set(runNotices.map((notice) => notice.message)));

  const outboxMessages = messages.research.outbox;
  const voiceMessages = messages.research.voice;
  const ocrMessages = messages.research.ocr;
  const staleMessages = messages.research.stale;
  const trustMessages = messages.research.trust;
  const verifyLabel = staleMessages.verify;
  const rwandaMessages = messages.research.rwanda;

  const handleVoiceTranscript = (text: string) => {
    setQuestion((current) => (current ? `${current.trim()} ${text}` : text));
    void sendTelemetryEvent('voice_dictation_used');
  };

  const handleOcrText = (text: string) => {
    setContext((current) => (current ? `${current}\n${text}` : text));
    void sendTelemetryEvent('camera_ocr_added');
  };

  const handleHitlRequest = useCallback(async () => {
    if (!latestRun?.runId || hitlRequestPending || hitlQueued || !online) {
      return;
    }
    setHitlRequestPending(true);
    const reason =
      trustMessages.manualHitlReason ??
      (locale === 'fr'
        ? 'Revue humaine demandée depuis le panneau de confiance.'
        : 'Manual review requested from the trust panel.');
    try {
      await requestHitlReview(latestRun.runId, {
        reason,
        manual: true,
        orgId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
      });
      setHitlQueued(true);
      toast.success(hitlMessage);
      void sendTelemetryEvent('hitl_requested', {
        runId: latestRun.runId,
        manual: true,
        alreadyPending:
          latestRun.data?.risk.hitl_required ?? latestRun.trustPanel?.risk?.hitlRequired ?? false,
      });
    } catch (error) {
      console.error('hitl_request_failed', error);
      const failureMessage =
        trustMessages.hitlRequestFailed ??
        (locale === 'fr'
          ? 'Impossible de demander une revue humaine. Réessayez plus tard.'
          : 'Unable to request human review. Try again shortly.');
      toast.error(failureMessage);
    } finally {
      setHitlRequestPending(false);
    }
  }, [
    latestRun,
    hitlRequestPending,
    hitlQueued,
    trustMessages.manualHitlReason,
    trustMessages.hitlRequestFailed,
    locale,
    hitlMessage,
    online,
  ]);

  const handleRwandaLanguageSelect = (language: 'fr' | 'en' | 'rw') => {
    void sendTelemetryEvent('rwanda_language_toggle', { language });
  };

  const handleReadingModeChange = (mode: ReadingMode) => {
    setReadingMode(mode);
    void sendTelemetryEvent('reading_mode_changed', { mode });
  };

  const citationBadges = (note?: string) => {
    const badges = [] as string[];
    if (!note) return badges;
    if (note.toLowerCase().includes('officiel')) badges.push('Officiel');
    if (note.toLowerCase().includes('consolid')) badges.push('Consolidé');
    if (note.toLowerCase().includes('traduction')) badges.push('Traduction');
    if (note.toLowerCase().includes('jurisprudence')) badges.push('Jurisprudence');
    return badges.length > 0 ? badges : ['Officiel'];
  };

  const versionPoints = useMemo(() => {
    if (!payload?.rules?.length) return [] as Array<{ label: string; date: string; isCurrent?: boolean }>;
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return payload.rules.slice(0, 3).map((rule, index) => {
      let formattedDate = rule.effective_date;
      const parsed = rule.effective_date ? new Date(rule.effective_date) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        formattedDate = formatter.format(parsed);
      }
      return {
        label: rule.citation,
        date: formattedDate,
        isCurrent: index === 0,
      };
    });
  }, [payload, locale]);

  const trustPanel = latestRun?.trustPanel ?? null;
  const trustCitationSummary = trustPanel?.citationSummary ?? null;
  const trustRisk = trustPanel?.risk ?? null;
  const verification = latestRun?.verification ?? trustRisk?.verification ?? null;
  const allowlistViolations = verification?.allowlistViolations ?? EMPTY_VIOLATIONS;
  const verificationNotes = verification?.notes ?? [];
  const verificationStatus = verification?.status ?? null;

  useEffect(() => {
    if (!latestRun?.runId) {
      setHitlQueued(false);
      setHitlRequestPending(false);
      return;
    }
    const requiresHitl = Boolean(
      latestRun.data?.risk.hitl_required ?? latestRun.trustPanel?.risk?.hitlRequired ?? false,
    );
    setHitlQueued(requiresHitl);
    setHitlRequestPending(false);
  }, [latestRun]);

  const fallbackViolationHosts = useMemo(() => {
    if (allowlistViolations.length === 0) return [] as string[];
    const hosts = allowlistViolations
      .map((url) => {
        try {
          return new URL(url).hostname;
        } catch (error) {
          return url;
        }
      })
      .filter((value) => Boolean(value));
    return Array.from(new Set(hosts));
  }, [allowlistViolations]);

  const allowlistClean = trustCitationSummary
    ? trustCitationSummary.nonAllowlisted.length === 0
    : allowlistViolations.length === 0;

  const allowlistStats = useMemo(() => {
    if (!trustCitationSummary || trustCitationSummary.total === 0) {
      return null;
    }
    const ratioPercent = Math.round(trustCitationSummary.ratio * 100);
    return trustMessages.allowlistStats
      .replace('{allowlisted}', trustCitationSummary.allowlisted.toString())
      .replace('{total}', trustCitationSummary.total.toString())
      .replace('{ratio}', ratioPercent.toString());
  }, [trustCitationSummary, trustMessages.allowlistStats]);

  const allowlistDetails = trustCitationSummary
    ? trustCitationSummary.nonAllowlisted.map((item) =>
        item.title ? `${item.title} — ${item.url}` : item.url,
      )
    : fallbackViolationHosts;

  const fallbackTranslationWarnings = useMemo(() => {
    if (!payload?.citations?.length) return [] as typeof payload.citations;
    return payload.citations.filter((citation) => {
      const note = citation.note?.toLowerCase() ?? '';
      return note.includes('traduction') || note.includes('translation') || note.includes('langue');
    });
  }, [payload]);

  const translationWarnings = trustCitationSummary?.translationWarnings?.length
    ? trustCitationSummary.translationWarnings
    : fallbackTranslationWarnings.map((citation) => `${citation.title} — ${citation.note ?? ''}`.trim());

  const nonBindingRules = useMemo(() => {
    if (!payload?.rules?.length) return [] as typeof payload.rules;
    return payload.rules.filter((rule) => !rule.binding);
  }, [payload]);

  const citationHosts = useMemo(() => {
    if (!payload?.citations?.length) return [] as Array<{ host: string; count: number }>;
    const counts = new Map<string, number>();
    for (const citation of payload.citations) {
      try {
        const host = new URL(citation.url).hostname || citation.url;
        counts.set(host, (counts.get(host) ?? 0) + 1);
      } catch (error) {
        counts.set(citation.url, (counts.get(citation.url) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count);
  }, [payload]);

  const planSummary = latestRun ? (latestRun.reused ? trustMessages.planReused : trustMessages.planNew) : null;
  const riskLabelSummary = payload
    ? trustMessages.riskLabel.replace('{level}', trustMessages.riskLevels[payload.risk.level])
    : null;
  const hitlSummary = payload
    ? payload.risk.hitl_required || hitlQueued
      ? trustMessages.hitlRequired
      : trustMessages.hitlNotRequired
    : null;
  const hitlQueuedLabel =
    messages.actions.hitlQueued ?? (locale === 'fr' ? 'Revue en attente' : 'Queued for review');
  const hitlAlreadyRequired = Boolean(
    payload?.risk.hitl_required ?? trustRisk?.hitlRequired ?? false,
  );
  const hitlButtonLabel = hitlQueued || hitlAlreadyRequired ? hitlQueuedLabel : messages.actions.hitl;
  const hitlButtonDisabled =
    !latestRun?.runId || hitlRequestPending || hitlQueued || hitlAlreadyRequired || !online;
  const verificationMessage =
    verificationStatus === 'hitl_escalated' ? trustMessages.verificationHitl : trustMessages.verificationPassed;
  const allowlistSummary = allowlistClean ? trustMessages.allowlistClean : trustMessages.allowlistIssues;
  const translationSummary =
    translationWarnings.length === 0 ? trustMessages.translationNone : trustMessages.translationWarnings;
  const bindingSummary = trustCitationSummary
    ? trustCitationSummary.rules.nonBinding === 0
      ? trustMessages.bindingAll
      : trustMessages.bindingWarnings
    : nonBindingRules.length === 0
      ? trustMessages.bindingAll
      : trustMessages.bindingWarnings;

  const bindingCountsMessage = trustCitationSummary
    ? trustMessages.bindingCounts
        .replace('{binding}', trustCitationSummary.rules.binding.toString())
        .replace('{total}', trustCitationSummary.rules.total.toString())
    : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      toast.error(validationMessage);
      return;
    }

    if (!online) {
      enqueue({ question, context, confidentialMode });
      toast.info(outboxMessages.queued);
      void sendTelemetryEvent('outbox_enqueued', { offline: true });
      setQuestion('');
      setContext('');
      return;
    }

    void sendTelemetryEvent('run_submitted', {
      questionLength: question.length,
      ohadaMode,
      euOverlay,
      confidentialMode,
    });

    try {
      const data = await mutation.mutateAsync({
        question,
        context,
        orgId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
        confidentialMode,
      });
      setLatestRun(data);
      toggle(true);
      toast.success(successMessage);
      void sendTelemetryEvent('run_completed', {
        runId: data.runId,
        jurisdiction: data.data?.jurisdiction.country ?? null,
        risk: data.data?.risk.level ?? null,
      });
      registerInstallSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent indisponible';
      toast.error(message);
      void sendTelemetryEvent('run_failed', { message });
      enqueue({ question, context, confidentialMode });
      toast.info(outboxMessages.queued);
      void sendTelemetryEvent('outbox_enqueued', { offline: false });
    }
  }

  function handleBilingualSelect(language: 'fr' | 'en') {
    void sendTelemetryEvent('bilingual_toggle', {
      language,
      jurisdiction: jurisdictionCode ?? null,
    });
  }

  function handleCitationVisit(url: string) {
    void sendTelemetryEvent('citation_clicked', {
      url,
      jurisdiction: jurisdictionCode ?? null,
    });
  }

  const staleThresholdDays = 90;
  const staleCutoff = Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000;

  const isCitationStale = (date: string) => {
    if (!online) return true;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed.getTime() < staleCutoff;
  };

  const processOutboxItem = useCallback(
    async (item: OutboxItem, source: 'manual' | 'auto') => {
      try {
        const data = await mutation.mutateAsync({
          question: item.question,
          context: item.context,
          orgId: DEMO_ORG_ID,
          userId: DEMO_USER_ID,
          confidentialMode: item.confidentialMode,
        });
        setLatestRun(data);
        if (source === 'manual' || !open) {
          toggle(true);
        }
        const toastId = `outbox-${item.id}`;
        const successLabel = source === 'manual' ? successMessage : outboxMessages.sent ?? successMessage;
        toast.success(successLabel, { id: toastId });
        void sendTelemetryEvent(source === 'manual' ? 'outbox_retry' : 'outbox_auto_flush', {
          success: true,
          runId: data.runId,
        });
        registerInstallSuccess();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Agent indisponible';
        toast.error(message, { id: `outbox-${item.id}` });
        void sendTelemetryEvent(source === 'manual' ? 'outbox_retry' : 'outbox_auto_flush', {
          success: false,
          message,
        });
        return false;
      }
    },
    [mutation, open, toggle, successMessage, outboxMessages.sent, registerInstallSuccess],
  );

  async function handleOutboxRetry(item: OutboxItem) {
    if (!online) {
      toast.info(outboxMessages.stillOffline);
      return;
    }
    const success = await processOutboxItem(item, 'manual');
    if (success) {
      remove(item.id);
    }
  }

  useEffect(() => {
    if (!online || outboxItems.length === 0) {
      return;
    }
    void flush((item) => processOutboxItem(item, 'auto'));
  }, [online, outboxItems, flush, processOutboxItem]);

  const verifyCitation = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    void sendTelemetryEvent('citation_verify', { url });
  };

  const { handleExportPdf, handleExportDocx } = useIracExportActions({
    payload,
    locale,
    loadingMessages: { pdf: exportPdfMessage, docx: exportDocxMessage },
    successMessages: { pdf: exportPdfSuccessMessage, docx: exportDocxSuccessMessage },
    errorMessage: exportErrorMessage,
  });

  const trustSummaryData = {
    verificationMessage,
    verificationNotes,
    allowlistSummary,
    allowlistDetails,
    allowlistStats,
    translationSummary,
    translationWarnings,
    bindingSummary,
    bindingCountsMessage,
    planSummary,
    riskLabelSummary,
    hitlSummary,
    citationHosts,
  };

  return (
    <div className="space-y-8">
      <header className="space-y-6">
        <ResearchOfflineBanner online={online} message={outboxMessages.offline} />
        <ResearchQueryForm
          question={question}
          context={context}
          ohadaMode={ohadaMode}
          euOverlay={euOverlay}
          confidentialMode={confidentialMode}
          processingLabel={processingLabel}
          submitLabel={messages.actions.submit}
          contextPlaceholder={contextPlaceholder}
          messages={{
            heroPlaceholder: messages.research.heroPlaceholder,
            ohadaMode: messages.research.ohadaMode,
            euOverlay: messages.research.euOverlay,
            confidentialMode: messages.research.confidentialMode,
          }}
          voiceMessages={voiceMessages}
          ocrMessages={ocrMessages}
          confidentialMessages={confidentialMessages}
          isSubmitting={mutation.isPending}
          onSubmit={onSubmit}
          onQuestionChange={setQuestion}
          onContextChange={setContext}
          onToggleOhada={() => setOhadaMode((prev) => !prev)}
          onToggleEuOverlay={() => setEuOverlay((prev) => !prev)}
          onToggleConfidential={() => setConfidentialMode(!confidentialMode)}
          onVoiceTranscript={handleVoiceTranscript}
          onOcrText={handleOcrText}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{autoDetectionLabel}</Badge>
          <Badge variant="success">{ohadaPriorityLabel}</Badge>
          <Badge variant="outline">{wcagLabel}</Badge>
          {confidentialMode ? (
            <Badge variant="warning">{messages.research.confidentialMode}</Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => toggle(true)}>
            {messages.research.plan}
          </Button>
        </div>
        <ReadingModeToggle
          mode={readingMode}
          onChange={handleReadingModeChange}
          labels={{
            label: readingModeMessages.label,
            research: readingModeMessages.research,
            brief: readingModeMessages.brief,
            evidence: readingModeMessages.evidence,
          }}
          descriptions={readingModeDescriptions}
        />
      </header>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div id="outbox-panel">
            <OutboxPanel
              items={outboxItems}
              locale={locale}
              onRetry={handleOutboxRetry}
              onRemove={remove}
              messages={outboxMessages}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{messages.research.jurisdictionLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {jurisdictionEntries.map((entry) => (
                  <JurisdictionChip key={entry.id} code={entry.code} label={entry.label} badges={entry.badges} />
                ))}
              </div>
              <p className="text-xs text-slate-400">{messages.research.jurisdictionNote}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.research.filters}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>{messages.research.publicationDate}</span>
                <span>—</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{messages.research.entryIntoForce}</span>
                <span>—</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{messages.research.consolidatedOnly}</span>
                <Switch checked label="" onClick={() => toast.info(consolidatedMessage)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <ResearchResultsPane
          payload={payload}
          readingMode={readingMode}
          researchMessages={messages.research}
          confidentialMode={confidentialMode}
          confidentialBanner={confidentialMessages.banner ?? null}
          isMaghreb={isMaghreb}
          isCanadian={isCanadian}
          isSwiss={isSwiss}
          isRwanda={isRwanda}
          noticeMessages={noticeMessages}
          hitlButtonLabel={hitlButtonLabel}
          hitlButtonDisabled={hitlButtonDisabled}
          onHitlRequest={handleHitlRequest}
          onBilingualSelect={handleBilingualSelect}
          onRwandaLanguageSelect={handleRwandaLanguageSelect}
          citationBadges={citationBadges}
          verifyLabel={verifyLabel}
          staleLabel={staleMessages.label}
          isCitationStale={isCitationStale}
          onCitationVisit={handleCitationVisit}
          onCitationVerify={verifyCitation}
          hyphenatedClass={hyphenatedClass}
          trustSummary={trustSummaryData}
          awaiting={{ title: awaitingTitle, body: awaitingBody, secondary: awaitingSecondary }}
          exportLabels={{
            copy: messages.actions.copy,
            exportPdf: messages.actions.exportPdf,
            exportDocx: messages.actions.exportDocx,
          }}
          onExportPdf={handleExportPdf}
          onExportDocx={handleExportDocx}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{messages.research.evidence}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload?.citations?.length ? (
                payload.citations.map((citation) => {
                  const stale = isCitationStale(citation.date ?? '');
                  return (
                    <CitationCard
                      key={citation.url}
                      title={citation.title}
                      publisher={citation.court_or_publisher}
                      date={citation.date}
                      url={citation.url}
                      note={citation.note}
                      badges={citationBadges(citation.note)}
                      onVisit={handleCitationVisit}
                      stale={stale}
                      staleLabel={staleMessages.label}
                      verifyLabel={verifyLabel}
                      onVerify={verifyCitation}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-slate-300">{citationsEmpty}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.research.timeline}</CardTitle>
            </CardHeader>
            <CardContent>
              {versionPoints.length > 0 ? (
                <VersionTimeline points={versionPoints} />
              ) : (
                <p className="text-sm text-slate-300">{timelineEmpty}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.research.opposingView}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>{opposingDescription}</p>
              <Separator />
              <Button variant="outline" onClick={() => toast.info(opposingMessage)}>{opposingButton}</Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <PlanDrawer
        open={open}
        onOpenChange={toggle}
        toolLogs={planLogs}
        plan={planSteps ?? undefined}
        reused={planReused}
        title={messages.research.plan}
        description={planDescription}
      />
    </div>
  );
}
