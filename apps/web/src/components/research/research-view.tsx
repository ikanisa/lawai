'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';
import { AUTONOMOUS_JUSTICE_SUITE } from '../../../../../packages/shared/src/config/autonomous-suite';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { JurisdictionChip } from '../jurisdiction-chip';
import type { JurisdictionChipProps } from '../jurisdiction-chip';
import { RiskBanner } from '../risk-banner';
import { ComplianceBanner } from '../compliance-banner';
import { LanguageBanner } from '../language-banner';
import { BilingualToggle } from '../bilingual-toggle';
import { IRACAccordion } from '../irac-accordion';
import { CitationCard } from '../citation-card';
import { VersionTimeline } from '../version-timeline';
import { PlanDrawer } from '../plan-drawer';
import { usePlanDrawer } from '../../state/plan-drawer';
import { VoiceInputButton } from './voice-input-button';
import { CameraOcrButton } from './camera-ocr-button';
import { OutboxPanel } from './outbox-panel';
import { ReadingModeToggle } from './reading-mode-toggle';
import { ArticleAnchorList } from './article-anchor-list';
import { UserControlPrompts } from './user-control-prompts';
import { ComplianceAlerts } from './compliance-alerts';
import {
  DEMO_ORG_ID,
  DEMO_USER_ID,
  submitResearchQuestion,
  sendTelemetryEvent,
  type AgentRunResponse,
} from '../../lib/api';
import type { Messages, Locale } from '../../lib/i18n';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { exportIracToDocx, exportIracToPdf } from '../../lib/exporters';
import { useOnlineStatus } from '../../hooks/use-online-status';
import { useOutbox, type OutboxItem } from '../../hooks/use-outbox';
import { useReadingMode } from '../../hooks/use-reading-mode';
import { isDateStale } from '../../lib/staleness';
import { cn } from '../../lib/utils';

const SUITE_MANIFEST = AUTONOMOUS_JUSTICE_SUITE;
const AGENT_OPTIONS = Object.entries(SUITE_MANIFEST.agents)
  .map(([key, definition]) => {
    const code = typeof definition.code === 'string' ? definition.code : key;
    const label = typeof definition.label === 'string' ? definition.label : code;
    const mission = typeof definition.mission === 'string' ? definition.mission : '';
    return { key, code, label, mission };
  })
  .filter((option) => option.code)
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

const DEFAULT_AGENT_CODE =
  AGENT_OPTIONS.find((option) => option.key === 'counsel_research')?.code ??
  SUITE_MANIFEST.agents.counsel_research?.code ??
  AGENT_OPTIONS[0]?.code ??
  'conseil_recherche';

interface ResearchViewProps {
  messages: Messages;
  locale: Locale;
}

type IracRule = {
  citation: string;
  source_url: string;
  binding: boolean;
  effective_date: string;
};

type IracPayload = {
  jurisdiction: {
    country: string;
    eu: boolean;
    ohada: boolean;
  };
  issue: string;
  rules: IracRule[];
  application: string;
  conclusion: string;
  citations: Array<{
    title: string;
    court_or_publisher: string;
    date: string;
    url: string;
    note?: string;
  }>;
  risk: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    why: string;
    hitl_required: boolean;
  };
};

export function ResearchView({ messages, locale }: ResearchViewProps) {
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [ohadaMode, setOhadaMode] = useState(true);
  const [euOverlay, setEuOverlay] = useState(true);
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [agentCode, setAgentCode] = useState<string>(DEFAULT_AGENT_CODE);
  const [latestRun, setLatestRun] = useState<AgentRunResponse | null>(null);
  const { open, toggle } = usePlanDrawer();
  const online = useOnlineStatus();
  const { items: outboxItems, enqueue, remove, flush } = useOutbox();
  const { mode, setMode } = useReadingMode();
  const modeTelemetryRef = useRef(mode);

  const agentOptions = AGENT_OPTIONS;
  const selectedAgent = useMemo(
    () => agentOptions.find((option) => option.code === agentCode) ?? agentOptions[0],
    [agentOptions, agentCode],
  );
  const executedAgentLabel = latestRun?.agent?.label ?? selectedAgent?.label ?? '';

  const badgeMessages = messages.research.badges;
  const agentSelectorMessages = messages.research.agentSelector;
  const jurisdictionEntries = useMemo<Array<{
    code: string;
    id: string;
    label: string;
    badges: NonNullable<JurisdictionChipProps['badges']>;
  }>>(
    () =>
      SUPPORTED_JURISDICTIONS.map((jurisdiction: (typeof SUPPORTED_JURISDICTIONS)[number]) => {
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
        if (jurisdiction.maghreb) {
          badges.push({ label: badgeMessages.maghreb, variant: 'warning' });
        }
        if (jurisdiction.notes?.includes('swiss')) {
          badges.push({ label: badgeMessages.swiss, variant: 'outline' });
        }
        if (jurisdiction.id === 'RW') {
          badges.push({ label: badgeMessages.rwanda, variant: 'success' });
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
  const exportPdfMessage = locale === 'fr' ? 'Export PDF en préparation…' : 'Preparing PDF export…';
  const exportDocxMessage = locale === 'fr' ? 'Export DOCX en préparation…' : 'Preparing DOCX export…';
  const exportPdfSuccessMessage = locale === 'fr' ? 'PDF prêt à être téléchargé.' : 'PDF ready to download.';
  const exportDocxSuccessMessage = locale === 'fr' ? 'DOCX prêt à être téléchargé.' : 'DOCX ready to download.';
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

  const mutation = useMutation({
    mutationFn: submitResearchQuestion,
  });

  const payload: IracPayload | null = (latestRun?.data as IracPayload | null) ?? null;
  const jurisdictionCode = payload?.jurisdiction.country;
  const isMaghreb = jurisdictionCode === 'MA' || jurisdictionCode === 'TN' || jurisdictionCode === 'DZ';
  const isCanadian = jurisdictionCode === 'CA-QC' || jurisdictionCode === 'CA';
  const isSwiss = jurisdictionCode === 'CH';
  const isRwanda = jurisdictionCode === 'RW';
  const telemetryEnabled = !confidentialMode;

  const planSteps = latestRun?.plan ?? null;
  const planLogs = latestRun?.toolLogs ?? [];
  const planReused = Boolean(latestRun?.reused);
  const runNotices = latestRun?.notices ?? [];
  const noticeMessages = Array.from(new Set(runNotices.map((notice) => notice.message)));

  useEffect(() => {
    if (!telemetryEnabled) {
      modeTelemetryRef.current = mode;
      return;
    }
    if (modeTelemetryRef.current === mode) {
      return;
    }
    modeTelemetryRef.current = mode;
    void sendTelemetryEvent('reading_mode_changed', { mode });
  }, [mode, telemetryEnabled]);

  const outboxMessages = messages.research.outbox;
  const voiceMessages = messages.research.voice;
  const ocrMessages = messages.research.ocr;
  const staleMessages = messages.research.stale;
  const verifyLabel = staleMessages.verify;
  const readingModeMessages = messages.research.readingModes;
  const anchorMessages = messages.research.anchors;
  const userControlMessages = messages.research.userControls;
  const citationsVisitLabel = messages.research.citationsVisit;

  const handleVoiceTranscript = (text: string) => {
    setQuestion((current) => (current ? `${current.trim()} ${text}` : text));
    if (telemetryEnabled) {
      void sendTelemetryEvent('voice_dictation_used');
    }
  };

  const handleOcrText = (text: string) => {
    setContext((current) => (current ? `${current}\n${text}` : text));
    if (telemetryEnabled) {
      void sendTelemetryEvent('camera_ocr_added');
    }
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

  const handleAnchorSelect = useCallback((id: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.setAttribute('data-anchor-highlight', '1');
    const cleanupTarget = element;
    window.setTimeout(() => {
      cleanupTarget.removeAttribute('data-anchor-highlight');
    }, 1600);
  }, []);

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

  const anchorItems = useMemo(() => {
    if (!payload) {
      return [] as Array<{ id: string; label: string }>;
    }
    const anchors: Array<{ id: string; label: string }> = [
      { id: 'irac-issue', label: anchorMessages.issue },
      { id: 'irac-rules', label: anchorMessages.rules },
      { id: 'irac-application', label: anchorMessages.application },
      { id: 'irac-conclusion', label: anchorMessages.conclusion },
    ];

    const ruleTemplate = anchorMessages.rule ?? 'Règle {index}';
    payload.rules.forEach((_rule, index) => {
      anchors.push({
        id: `irac-rule-${index + 1}`,
        label: ruleTemplate.replace('{index}', String(index + 1)),
      });
    });

    const citationTemplate = anchorMessages.citation ?? 'Citation {index}';
    payload.citations?.forEach((_citation, index) => {
      anchors.push({
        id: `citation-${index + 1}`,
        label: citationTemplate.replace('{index}', String(index + 1)),
      });
    });

    return anchors;
  }, [payload, anchorMessages]);

  const trustMessages = messages.research.trust;
  const trustPanel = latestRun?.trustPanel ?? null;
  const trustCitationSummary = trustPanel?.citationSummary ?? null;
  const trustProvenance = trustPanel?.provenance ?? null;
  const residencyBreakdown = trustProvenance?.residencyBreakdown ?? [];
  const trustRisk = trustPanel?.risk ?? null;
  const verification = latestRun?.verification ?? trustRisk?.verification ?? null;
  const trustCaseQuality = trustPanel?.caseQuality ?? null;
  const trustCompliance = trustPanel?.compliance ?? null;
  const complianceMessages = messages.research.compliance;
  const complianceExportCopy = useMemo(
    () => ({
      heading: trustMessages.complianceHeading,
      fria: trustMessages.complianceFria,
      friaFallback: trustMessages.complianceFriaFallback,
      cepej: trustMessages.complianceCepej,
      cepejFallback: trustMessages.complianceCepejFallback,
      statute: trustMessages.complianceStatute,
      statuteFallback: trustMessages.complianceStatuteFallback,
      disclosures: trustMessages.complianceDisclosures,
      disclosuresFallback: trustMessages.complianceDisclosuresFallback,
      resolved: trustMessages.complianceResolved,
      consentAcknowledged: trustMessages.complianceConsentAcknowledged,
      consentPending: trustMessages.complianceConsentPending,
      coeAcknowledged: trustMessages.complianceCoeAcknowledged,
      coePending: trustMessages.complianceCoePending,
      unavailable: trustMessages.complianceUnavailable,
    }),
    [trustMessages],
  );
  const complianceExportOptions = useMemo(
    () => ({
      summary: trustCompliance,
      messages: complianceMessages,
      copy: complianceExportCopy,
    }),
    [trustCompliance, complianceMessages, complianceExportCopy],
  );
  const treatmentGraph = trustCaseQuality?.treatmentGraph ?? [];
  const statuteAlignments = trustCaseQuality?.statuteAlignments ?? [];
  const politicalFlags = trustCaseQuality?.politicalFlags ?? [];
  const treatmentDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const formatTreatmentDate = (value?: string | null) => {
    if (!value) {
      return trustMessages.treatmentUnknownDate;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return trustMessages.treatmentUnknownDate;
    }
    return treatmentDateFormatter.format(parsed);
  };
  const allowlistViolations = useMemo(
    () => verification?.allowlistViolations ?? [],
    [verification?.allowlistViolations],
  );

  const trustComplianceIssues = useMemo(() => {
    if (!trustCompliance) {
      return [] as string[];
    }
    const issues: string[] = [];
    if (trustCompliance.fria.required) {
      const reason = trustCompliance.fria.reasons[0] ?? trustMessages.complianceFriaFallback;
      issues.push(trustMessages.complianceFria.replace('{reason}', reason));
    }
    if (!trustCompliance.cepej.passed) {
      const violationTexts = trustCompliance.cepej.violations.length > 0
        ? trustCompliance.cepej.violations
            .map(
              (code) => complianceMessages?.cepejViolations?.[code as keyof typeof complianceMessages.cepejViolations] ?? code,
            )
            .join(', ')
        : trustMessages.complianceCepejFallback;
      issues.push(trustMessages.complianceCepej.replace('{detail}', violationTexts));
    }
    if (!trustCompliance.statute.passed) {
      const statuteTexts = trustCompliance.statute.violations.length > 0
        ? trustCompliance.statute.violations
            .map(
              (code) => complianceMessages?.statuteViolations?.[code as keyof typeof complianceMessages.statuteViolations] ?? code,
            )
            .join(', ')
        : trustMessages.complianceStatuteFallback;
      issues.push(trustMessages.complianceStatute.replace('{detail}', statuteTexts));
    }
    if (
      trustCompliance.disclosures.missing.length > 0 ||
      !trustCompliance.disclosures.consentSatisfied ||
      !trustCompliance.disclosures.councilSatisfied
    ) {
      const disclosureTexts = trustCompliance.disclosures.missing.length > 0
        ? trustCompliance.disclosures.missing
            .map(
              (code) =>
                complianceMessages?.disclosuresMissing?.[code as keyof typeof complianceMessages.disclosuresMissing] ?? code,
            )
            .join(', ')
        : null;
      if (disclosureTexts) {
        issues.push(trustMessages.complianceDisclosures.replace('{detail}', disclosureTexts));
      } else {
        issues.push(trustMessages.complianceDisclosuresFallback);
      }
    }
    return issues;
  }, [trustCompliance, complianceMessages, trustMessages]);

  const consentAcknowledgementLine = useMemo(() => {
    const version = trustCompliance?.disclosures.requiredConsentVersion ?? null;
    if (!version) {
      return null;
    }
    return trustCompliance.disclosures.consentSatisfied
      ? trustMessages.complianceConsentAcknowledged.replace('{version}', version)
      : trustMessages.complianceConsentPending.replace('{version}', version);
  }, [trustCompliance, trustMessages]);

  const councilAcknowledgementLine = useMemo(() => {
    const version = trustCompliance?.disclosures.requiredCoeVersion ?? null;
    if (!version) {
      return null;
    }
    return trustCompliance.disclosures.councilSatisfied
      ? trustMessages.complianceCoeAcknowledged.replace('{version}', version)
      : trustMessages.complianceCoePending.replace('{version}', version);
  }, [trustCompliance, trustMessages]);

  const complianceAcknowledgementLines = useMemo(
    () =>
      [consentAcknowledgementLine, councilAcknowledgementLine].filter(
        (line): line is string => typeof line === 'string' && line.length > 0,
      ),
    [consentAcknowledgementLine, councilAcknowledgementLine],
  );
  const verificationNotes = verification?.notes ?? [];
  const verificationStatus = verification?.status ?? null;

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
    if (!payload || !payload.citations.length) {
      return [] as IracPayload['citations'];
    }
    return payload.citations.filter((citation) => {
      const note = citation.note?.toLowerCase() ?? '';
      return note.includes('traduction') || note.includes('translation') || note.includes('langue');
    });
  }, [payload]);

  const translationWarnings = trustCitationSummary?.translationWarnings?.length
    ? trustCitationSummary.translationWarnings
    : fallbackTranslationWarnings.map((citation) => `${citation.title} — ${citation.note ?? ''}`.trim());

  const nonBindingRules = useMemo(() => {
    if (!payload || !payload.rules.length) {
      return [] as IracPayload['rules'];
    }
    return payload.rules.filter((rule) => !rule.binding);
  }, [payload]);

  const citationHosts = useMemo(() => {
    if (!payload || !payload.citations.length) {
      return [] as Array<{ host: string; count: number }>;
    }
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
    ? payload.risk.hitl_required
      ? trustMessages.hitlRequired
      : trustMessages.hitlNotRequired
    : null;
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

  const resultContainerClass = cn(
    'space-y-5',
    confidentialMode && 'confidential-blur',
    mode === 'brief' && 'lg:mx-auto lg:max-w-3xl',
  );

  const gridClass = cn(
    'grid gap-6',
    mode === 'brief' ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : 'xl:grid-cols-[320px_minmax(0,1fr)_320px]',
  );

  const showTrustPanel = Boolean(payload) && mode !== 'brief';
  const showRightColumn = Boolean(payload) && mode !== 'brief';
  const showTimelineCard = Boolean(payload) && mode !== 'brief';
  const showOpposingCard = Boolean(payload) && mode === 'research';
  const showEvidenceCard = Boolean(payload) && mode !== 'brief';
  const showAnchorList = Boolean(payload) && mode === 'evidence';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      toast.error(validationMessage);
      return;
    }

    if (!online) {
      enqueue({
        question,
        context,
        confidentialMode,
        agentCode,
        agentLabel: selectedAgent?.label ?? agentCode,
        agentSettings: null,
      });
      toast.info(outboxMessages.queued);
      if (telemetryEnabled) {
        void sendTelemetryEvent('outbox_enqueued', { offline: true, agent: agentCode });
      }
      setQuestion('');
      setContext('');
      return;
    }

    if (telemetryEnabled) {
      void sendTelemetryEvent('run_submitted', {
        questionLength: question.length,
        ohadaMode,
        euOverlay,
        confidentialMode,
        agent: agentCode,
      });
    }

    try {
      const data = await mutation.mutateAsync({
        question,
        context,
        orgId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
        confidentialMode,
        agentCode,
      });
      setLatestRun(data);
      toggle(true);
      toast.success(successMessage);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('avocat-run-success'));
      }
      if (telemetryEnabled) {
        void sendTelemetryEvent('run_completed', {
          runId: data.runId,
          jurisdiction: data.data?.jurisdiction.country ?? null,
          risk: data.data?.risk.level ?? null,
          agent: data.agent?.code ?? agentCode,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent indisponible';
      toast.error(message);
      if (telemetryEnabled) {
        void sendTelemetryEvent('run_failed', { message, agent: agentCode });
      }
      enqueue({
        question,
        context,
        confidentialMode,
        agentCode,
        agentLabel: selectedAgent?.label ?? agentCode,
        agentSettings: null,
      });
      toast.info(outboxMessages.queued);
      if (telemetryEnabled) {
        void sendTelemetryEvent('outbox_enqueued', { offline: false, agent: agentCode });
      }
    }
  }

  function handleBilingualSelect(language: string) {
    if (telemetryEnabled) {
      void sendTelemetryEvent('bilingual_toggle', {
        language,
        jurisdiction: jurisdictionCode ?? null,
      });
    }
  }

  function handleCitationVisit(url: string) {
    if (telemetryEnabled) {
      void sendTelemetryEvent('citation_clicked', {
        url,
        jurisdiction: jurisdictionCode ?? null,
      });
    }
  }

  const staleThresholdDays = 90;

  const isCitationStale = (date: string) =>
    isDateStale(date, { thresholdDays: staleThresholdDays, offline: !online });

  const handleOpenPlan = useCallback(() => {
    toggle(true);
    if (telemetryEnabled) {
      void sendTelemetryEvent('user_control_plan');
    }
  }, [toggle, telemetryEnabled]);

  const handleRequestHitl = useCallback(() => {
    toast.info(hitlMessage);
    if (telemetryEnabled) {
      void sendTelemetryEvent('user_control_hitl');
    }
  }, [hitlMessage, telemetryEnabled]);

  const handleViewSources = useCallback(() => {
    if (payload?.citations?.length) {
      handleAnchorSelect('citation-1');
    } else {
      toast.info(citationsEmpty);
    }
    if (telemetryEnabled) {
      void sendTelemetryEvent('user_control_sources', {
        hasCitations: Boolean(payload?.citations?.length),
      });
    }
  }, [payload, handleAnchorSelect, citationsEmpty, telemetryEnabled]);

  const handleExportBrief = useCallback(async () => {
    if (!payload) {
      toast.info(exportErrorMessage);
      return;
    }
    const toastId = 'export-pdf-brief';
    toast.loading(exportPdfMessage, { id: toastId });
    try {
      await exportIracToPdf(payload, locale, { compliance: complianceExportOptions });
      toast.success(exportPdfSuccessMessage, { id: toastId });
      if (telemetryEnabled) {
        void sendTelemetryEvent('user_control_export', { format: 'pdf' });
      }
    } catch (error) {
      console.error('export_pdf_failed', error);
      toast.error(exportErrorMessage, { id: toastId });
    }
  }, [
    payload,
    exportPdfMessage,
    exportPdfSuccessMessage,
    exportErrorMessage,
    locale,
    telemetryEnabled,
    complianceExportOptions,
  ]);

  const processOutboxItem = useCallback(
    async (item: OutboxItem, source: 'manual' | 'auto') => {
      if (item.confidentialMode && source === 'auto') {
        return false;
      }
      try {
        const data = await mutation.mutateAsync({
          question: item.question,
          context: item.context,
          orgId: DEMO_ORG_ID,
          userId: DEMO_USER_ID,
          confidentialMode: item.confidentialMode,
          agentCode: item.agentCode,
          agentSettings: item.agentSettings ?? undefined,
        });
        setLatestRun(data);
        if (source === 'manual' || !open) {
          toggle(true);
        }
        const toastId = `outbox-${item.id}`;
        const successLabel = source === 'manual' ? successMessage : outboxMessages.sent ?? successMessage;
        toast.success(successLabel, { id: toastId });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('avocat-run-success'));
        }
        const itemTelemetryEnabled = telemetryEnabled && !item.confidentialMode;
        if (itemTelemetryEnabled) {
          void sendTelemetryEvent(source === 'manual' ? 'outbox_retry' : 'outbox_auto_flush', {
            success: true,
            runId: data.runId,
            agent: data.agent?.code ?? item.agentCode,
          });
        }
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Agent indisponible';
        toast.error(message, { id: `outbox-${item.id}` });
        const itemTelemetryEnabled = telemetryEnabled && !item.confidentialMode;
        if (itemTelemetryEnabled) {
          void sendTelemetryEvent(source === 'manual' ? 'outbox_retry' : 'outbox_auto_flush', {
            success: false,
            message,
            agent: item.agentCode,
          });
        }
        return false;
      }
    },
    [mutation, open, toggle, successMessage, outboxMessages.sent, telemetryEnabled],
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
    if (telemetryEnabled) {
      void sendTelemetryEvent('citation_verify', { url });
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-6">
        <div className="glass-card rounded-3xl border border-slate-800/60 p-6 shadow-2xl">
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="hero-question">
              {messages.research.heroPlaceholder}
            </label>
            <div className="space-y-2">
              <Input
                id="hero-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={messages.research.heroPlaceholder}
              />
              <VoiceInputButton messages={voiceMessages} onTranscript={handleVoiceTranscript} />
            </div>
            <div className="space-y-2">
              <Textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder={contextPlaceholder}
              />
              <CameraOcrButton messages={ocrMessages} onText={handleOcrText} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-200" htmlFor="agent-profile">
                {agentSelectorMessages.label}
              </label>
              <select
                id="agent-profile"
                value={agentCode}
                onChange={(event) => setAgentCode(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-slate-400 focus:outline-none"
              >
                {agentOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                {selectedAgent?.mission || agentSelectorMessages.helper}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Switch checked={ohadaMode} onClick={() => setOhadaMode((prev) => !prev)} label={messages.research.ohadaMode} />
                <Switch checked={euOverlay} onClick={() => setEuOverlay((prev) => !prev)} label={messages.research.euOverlay} />
                <Switch
                  checked={confidentialMode}
                  onClick={() => setConfidentialMode((prev) => !prev)}
                  label={messages.research.confidentialMode}
                />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? processingLabel : messages.actions.submit}
              </Button>
            </div>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{executedAgentLabel || agentSelectorMessages.badge}</Badge>
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
      </header>

      {payload ? (
        <ReadingModeToggle mode={mode} onModeChange={setMode} messages={readingModeMessages} />
      ) : null}
      {showAnchorList ? (
        <ArticleAnchorList
          items={anchorItems}
          onSelect={handleAnchorSelect}
          title={anchorMessages.title}
          helper={anchorMessages.helper}
        />
      ) : null}

      <section className={gridClass}>
        <div className="space-y-4">
          <OutboxPanel
            items={outboxItems}
            locale={locale}
            onRetry={handleOutboxRetry}
            onRemove={remove}
            messages={outboxMessages}
          />
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

        <div className={resultContainerClass}>
          {payload ? (
            <div className="space-y-5">
              <RiskBanner risk={payload.risk} hitlLabel={messages.actions.hitl} onHitl={() => toast.info(hitlMessage)} />
              {isMaghreb && <LanguageBanner message={messages.research.languageWarning} />}
              {isCanadian && <LanguageBanner message={messages.research.canadaLanguageNotice} />}
              {isSwiss && <LanguageBanner message={messages.research.switzerlandLanguageNotice} />}
              {isRwanda && <LanguageBanner message={messages.research.rwandaLanguageNotice} />}
              {noticeMessages.map((message) => (
                <LanguageBanner key={message} message={message} />
              ))}
              {messages.research.compliance ? (
                <>
                  <ComplianceBanner
                    compliance={trustCompliance}
                    messages={messages.research.compliance}
                  />
                  <ComplianceAlerts
                    compliance={latestRun?.compliance ?? null}
                    messages={messages.research.compliance}
                  />
                </>
              ) : null}
              {isCanadian && (
                <BilingualToggle messages={messages.research.bilingual} onSelect={handleBilingualSelect} />
              )}
              {isRwanda && messages.research.rwandaToggle ? (
                <BilingualToggle messages={messages.research.rwandaToggle} onSelect={handleBilingualSelect} />
              ) : null}
              <IRACAccordion
                payload={payload}
                labels={messages.research.irac}
                onCopy={() => navigator.clipboard.writeText(JSON.stringify(payload, null, 2))}
                onExportPdf={async () => {
                  const toastId = 'export-pdf';
                  toast.loading(exportPdfMessage, { id: toastId });
                  try {
                    await exportIracToPdf(payload, locale, { compliance: complianceExportOptions });
                    toast.success(exportPdfSuccessMessage, { id: toastId });
                  } catch (error) {
                    console.error('export_pdf_failed', error);
                    toast.error(exportErrorMessage, { id: toastId });
                  }
                }}
                onExportDocx={async () => {
                  const toastId = 'export-docx';
                  toast.loading(exportDocxMessage, { id: toastId });
                  try {
                    await exportIracToDocx(payload, locale, { compliance: complianceExportOptions });
                    toast.success(exportDocxSuccessMessage, { id: toastId });
                  } catch (error) {
                    console.error('export_docx_failed', error);
                    toast.error(exportErrorMessage, { id: toastId });
                  }
                }}
                copyLabel={messages.actions.copy}
                exportPdfLabel={messages.actions.exportPdf}
                exportDocxLabel={messages.actions.exportDocx}
                anchorPrefix="irac"
                enableAnchors
              />
              <UserControlPrompts
                messages={userControlMessages}
                onOpenPlan={handleOpenPlan}
                onRequestHitl={handleRequestHitl}
                onViewSources={handleViewSources}
                onExport={handleExportBrief}
              />
              {showTrustPanel ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{trustMessages.title}</CardTitle>
                    <p className="text-sm text-slate-300">{trustMessages.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm text-slate-200">
                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.verificationHeading}</h4>
                    <p className="mt-1">{verificationMessage}</p>
                    {verificationNotes.length > 0 ? (
                      <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                        {verificationNotes.map((note) => (
                          <li key={`${note.code}-${note.message}`}>{note.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-slate-400">{trustMessages.verificationNotesEmpty}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.allowlistHeading}</h4>
                    <p className="mt-1">{allowlistSummary}</p>
                    {allowlistStats && <p className="mt-1 text-slate-300">{allowlistStats}</p>}
                    {allowlistDetails.length > 0 && (
                      <ul className="mt-2 space-y-1 list-inside list-disc text-amber-300">
                        {allowlistDetails.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.translationHeading}</h4>
                    <p className="mt-1">{translationSummary}</p>
                    {translationWarnings.length > 0 && (
                      <ul className="mt-2 space-y-1 list-inside list-disc text-amber-200">
                        {translationWarnings.map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.complianceHeading}</h4>
                    {trustCompliance ? (
                      <>
                        {trustComplianceIssues.length > 0 ? (
                          <ul className="mt-2 space-y-1 list-inside list-disc text-amber-200">
                            {trustComplianceIssues.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-slate-300">{trustMessages.complianceResolved}</p>
                        )}
                        {complianceAcknowledgementLines.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-400">
                            {complianceAcknowledgementLines.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-slate-400">{trustMessages.complianceUnavailable}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.bindingHeading}</h4>
                    <p className="mt-1">{bindingSummary}</p>
                    {bindingCountsMessage && <p className="mt-1 text-slate-300">{bindingCountsMessage}</p>}
                    {nonBindingRules.length > 0 && (
                      <ul className="mt-2 space-y-1 list-inside list-disc text-amber-200">
                        {nonBindingRules.map((rule) => (
                          <li key={`${rule.citation}-binding`}>{rule.citation}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.treatmentHeading}</h4>
                    {treatmentGraph.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-slate-300">
                        {treatmentGraph.map((entry, index) => (
                          <li key={`${entry.caseUrl}-${entry.treatment}-${index}`} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-100">{entry.treatment}</span>
                              <span className="text-xs text-slate-400">{formatTreatmentDate(entry.decidedAt)}</span>
                            </div>
                            <div className="text-xs text-slate-500 break-all">{entry.caseUrl}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-slate-400">{trustMessages.treatmentEmpty}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.statuteHeading}</h4>
                    {statuteAlignments.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-slate-300">
                        {statuteAlignments.map((entry, index) => (
                          <li key={`${entry.caseUrl}-${entry.statuteUrl}-${index}`} className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={entry.statuteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-legal-amber hover:underline"
                              >
                                {entry.article ?? trustMessages.statuteArticleFallback}
                              </a>
                              {typeof entry.alignmentScore === 'number' && (
                                <span className="text-xs text-slate-400">
                                  {trustMessages.statuteScoreLabel.replace(
                                    '{score}',
                                    Math.round(entry.alignmentScore).toString(),
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 break-all">{entry.caseUrl}</div>
                            {entry.rationale && (
                              <p className="text-xs text-slate-400">
                                <span className="font-semibold text-slate-300">
                                  {trustMessages.statuteRationaleLabel}
                                </span>{' '}
                                {entry.rationale}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-slate-400">{trustMessages.statuteEmpty}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.riskHeading}</h4>
                    {politicalFlags.length > 0 ? (
                      <ul className="mt-2 space-y-1 list-inside list-disc text-amber-200">
                        {politicalFlags.map((entry, index) => (
                          <li key={`${entry.caseUrl}-${entry.flag}-${index}`} className="space-y-1">
                            <span className="font-medium text-slate-100">{entry.flag}</span>
                            {entry.note && <p className="text-xs text-slate-400">{entry.note}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-slate-400">{trustMessages.riskEmpty}</p>
                    )}
                  </div>

                  {trustProvenance && (
                    <div>
                      <h4 className="font-semibold text-slate-100">{trustMessages.provenanceHeading}</h4>
                      <p className="mt-1">
                        {trustMessages.provenanceSummary.replace(
                          '{count}',
                          trustProvenance.totalSources.toString(),
                        )}
                      </p>
                      <div className="mt-2 space-y-1 text-slate-300">
                        <p>
                          {trustMessages.provenanceEli.replace(
                            '{count}',
                            trustProvenance.withEli.toString(),
                          )}
                        </p>
                        <p>
                          {trustMessages.provenanceEcli.replace(
                            '{count}',
                            trustProvenance.withEcli.toString(),
                          )}
                        </p>
                        <p>
                          {trustMessages.provenanceAkoma.replace(
                            '{count}',
                            trustProvenance.akomaArticles.toString(),
                          )}
                        </p>
                      </div>
                      <div className="mt-3">
                        <p className="font-medium text-slate-200">{trustMessages.provenanceResidencyHeading}</p>
                        {trustProvenance.residencyBreakdown.length > 0 ? (
                          <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                            {trustProvenance.residencyBreakdown.map(({ zone, count }) => (
                              <li key={`${zone}-${count}`}>
                                {trustMessages.provenanceResidencyItem
                                  .replace('{zone}', zone.toUpperCase())
                                  .replace('{count}', count.toString())}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-slate-400">{trustMessages.provenanceEmptyResidency}</p>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="font-medium text-slate-200">{trustMessages.provenanceBindingHeading}</p>
                        {trustProvenance.bindingLanguages.length > 0 ? (
                          <ul className="mt-2 space-y-1 list-inside list-disc text-slate-300">
                            {trustProvenance.bindingLanguages.map(({ language, count }) => (
                              <li key={`${language}-${count}`}>
                                {trustMessages.provenanceBindingItem
                                  .replace('{language}', language.toUpperCase())
                                  .replace('{count}', count.toString())}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-slate-400">{trustMessages.provenanceEmptyBinding}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-slate-100">{trustMessages.sourcesHeading}</h4>
                    {citationHosts.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-slate-300">
                        {citationHosts.map(({ host, count }) => {
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
                    {planSummary && <p className="mt-1">{planSummary}</p>}
                    {riskLabelSummary && <p className="mt-1">{riskLabelSummary}</p>}
                    {hitlSummary && (
                      <p className={`mt-1 ${payload?.risk.hitl_required ? 'text-amber-300' : ''}`}>{hitlSummary}</p>
                    )}
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
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{awaitingTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p>{awaitingBody}</p>
                <p>{awaitingSecondary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {showRightColumn ? (
          <div className="space-y-4">
            {showEvidenceCard ? (
              <Card>
                <CardHeader>
                  <CardTitle>{messages.research.evidence}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {residencyBreakdown.length > 0 ? (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-xs text-slate-300">
                      <p className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
                        {trustMessages.provenanceResidencyHeading}
                      </p>
                      <ul className="space-y-1">
                        {residencyBreakdown.map((entry) => (
                          <li key={`${entry.zone}-${entry.count}`}>
                            {trustMessages.provenanceResidencyItem
                              .replace('{zone}', entry.zone)
                              .replace('{count}', entry.count.toString())}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {payload?.citations?.length ? (
                    payload.citations.map((citation, index) => {
                      const stale = isCitationStale(citation.date ?? '');
                      return (
                        <CitationCard
                          key={citation.url}
                          id={`citation-${index + 1}`}
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
                          visitLabel={citationsVisitLabel}
                        />
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-300">{citationsEmpty}</p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {showTimelineCard ? (
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
            ) : null}

            {showOpposingCard ? (
              <Card>
                <CardHeader>
                  <CardTitle>{messages.research.opposingView}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <p>{opposingDescription}</p>
                  <Separator />
                  <Button variant="outline" onClick={() => toast.info(opposingMessage)}>
                    {opposingButton}
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
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
