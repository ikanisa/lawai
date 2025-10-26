import { vi } from 'vitest';
import type { IRACPayload } from '@avocat-ai/shared';

import type { Messages } from '@/lib/i18n';
import type {
  ResearchResultsPaneProps,
  TrustSummary,
} from '@/features/research/components/irac-results-pane';
import messagesEn from '../../messages/en.json';

const defaultResearchMessages = (messagesEn as Messages).research;

const basePayload: IRACPayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Responsabilité délictuelle',
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://www.legifrance.gouv.fr/code/article_lc/LEGIARTI000006417930/',
      binding: true,
      effective_date: '2024-01-01',
      note: 'Version en vigueur',
    },
  ],
  application: 'L\'acteur a commis une faute génératrice de responsabilité.',
  conclusion: 'La responsabilité civile est engagée.',
  citations: [
    {
      title: 'Code civil',
      court_or_publisher: 'Légifrance',
      date: '2024-01-01',
      url: 'https://www.legifrance.gouv.fr/code/article_lc/LEGIARTI000006417930/',
      note: 'consolidé',
    },
    {
      title: 'Doctrine 2024',
      court_or_publisher: 'Revue des sociétés',
      date: '2024-02-15',
      url: 'https://example.com/doctrine',
      note: 'commentaire',
    },
  ],
  risk: { level: 'LOW', why: 'Sources vérifiées', hitl_required: false },
};

const baseTrustSummary: TrustSummary = {
  verificationMessage: 'Verification passed',
  verificationNotes: [],
  allowlistSummary: 'All cited sources are allowlisted.',
  allowlistDetails: [],
  allowlistStats: null,
  translationSummary: 'No translation issues detected.',
  translationWarnings: [],
  bindingSummary: 'All cited rules are binding.',
  bindingCountsMessage: null,
  planSummary: 'New plan executed.',
  riskLabelSummary: 'Risk level: LOW',
  hitlSummary: 'Human review not required.',
  citationHosts: [{ host: 'legifrance.gouv.fr', count: 2 }],
};

function mergeTrustSummary(overrides: Partial<TrustSummary> | undefined): TrustSummary {
  if (!overrides) return baseTrustSummary;
  return { ...baseTrustSummary, ...overrides };
}

export function createResearchResultsPaneProps(
  overrides: Partial<ResearchResultsPaneProps> = {},
): ResearchResultsPaneProps {
  const researchMessages = overrides.researchMessages ?? defaultResearchMessages;
  const trustSummary = mergeTrustSummary(overrides.trustSummary);

  return {
    payload: overrides.payload ?? basePayload,
    readingMode: overrides.readingMode ?? 'brief',
    researchMessages,
    confidentialMode: overrides.confidentialMode ?? false,
    confidentialBanner: overrides.confidentialBanner ?? null,
    isMaghreb: overrides.isMaghreb ?? false,
    isCanadian: overrides.isCanadian ?? false,
    isSwiss: overrides.isSwiss ?? false,
    isRwanda: overrides.isRwanda ?? false,
    noticeMessages: overrides.noticeMessages ?? [],
    hitlButtonLabel: overrides.hitlButtonLabel ?? 'Request review',
    hitlButtonDisabled: overrides.hitlButtonDisabled ?? false,
    onHitlRequest: overrides.onHitlRequest ?? vi.fn(),
    onBilingualSelect: overrides.onBilingualSelect ?? vi.fn(),
    onRwandaLanguageSelect: overrides.onRwandaLanguageSelect ?? vi.fn(),
    citationBadges:
      overrides.citationBadges ?? ((note?: string) => (note ? [note.toUpperCase()] : [])),
    verifyLabel: overrides.verifyLabel ?? (researchMessages.stale?.verify ?? 'Verify'),
    staleLabel: overrides.staleLabel ?? (researchMessages.stale?.label ?? 'Stale'),
    isCitationStale: overrides.isCitationStale ?? (() => false),
    onCitationVisit: overrides.onCitationVisit ?? vi.fn(),
    onCitationVerify: overrides.onCitationVerify ?? vi.fn(),
    hyphenatedClass: overrides.hyphenatedClass,
    trustSummary,
    awaiting:
      overrides.awaiting ?? {
        title: 'Awaiting research',
        body: 'Submit a legal question to view the IRAC analysis.',
        secondary: 'The agent plan and review controls will appear here.',
      },
    exportLabels:
      overrides.exportLabels ?? {
        copy: 'Copy',
        exportPdf: 'Export PDF',
        exportDocx: 'Export DOCX',
      },
    onExportPdf: overrides.onExportPdf ?? vi.fn(),
    onExportDocx: overrides.onExportDocx ?? vi.fn(),
  } satisfies ResearchResultsPaneProps;
}
