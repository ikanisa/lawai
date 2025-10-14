'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import type { Locale, Messages } from '../../lib/i18n';
import {
  DEMO_ORG_ID,
  DEMO_USER_ID,
  fetchDraftingTemplates,
  createDraft,
  type DraftClauseComparison,
  type DraftExportMeta,
  type DraftGenerationResponse,
} from '../../lib/api';

interface DraftingViewProps {
  messages: Messages;
  locale: Locale;
}

interface DraftTemplate {
  id: string;
  matterType: keyof Messages['drafting']['templateCategories'] | string;
  jurisdiction: string;
  title: string;
  summary?: string | null;
  sections?: Array<{ heading: string; body: string }> | null;
  fillIns?: string[] | null;
  locale: string;
  scope?: string;
}

type IracRule = {
  citation: string;
  source_url: string;
  binding: boolean;
  effective_date: string;
};

const FALLBACK_CLAUSE_COMPARISONS: DraftClauseComparison[] = [
  {
    clauseId: 'clause-noncompete-ma',
    title: 'Clause de non-concurrence - Maroc',
    rationale:
      'Validite conditionnee a la duree, au perimetre et a une indemnisation proportionnee (Code du travail art. 61 bis).',
    baseline:
      'Le salarie s engage a ne pas exercer d activites concurrentes pendant douze (12) mois dans un rayon de dix (10) kilometres apres la rupture du contrat.',
    proposed:
      'Le salarie s engage a ne pas exercer d activites concurrentes pendant vingt-quatre (24) mois sur le territoire marocain, moyennant une indemnisation mensuelle egale a 30% de la remuneration moyenne.',
    diff: {
      summary: { additions: 0, deletions: 0, net: 0 },
      changes: [],
      recommendation: 'Generez un brouillon pour analyser la proportionnalite exacte de la clause.',
    },
    riskLevel: 'medium',
    citations: [
      {
        title: 'Code du travail marocain - Article 61 bis',
        url: 'https://www.sgg.gov.ma/Portals/1/lois/Loi_travail_65-99.pdf',
        binding: true,
      },
    ],
  },
  {
    clauseId: 'clause-hardship-ohada',
    title: 'Clause de hardship - OHADA',
    rationale:
      'Prevoir une renegociation lorsque l equilibre contractuel est bouleverse (AUSCGIE 2014).',
    baseline:
      'Les Parties conviennent de renegocier de bonne foi le contrat en cas de changement economique majeur affectant l equilibre initial.',
    proposed:
      'Les Parties s engagent a renegocier dans les quinze (15) jours suivant la notification d un evenement qui bouleverse l equilibre economique; a defaut d accord, le litige est soumis a la CCJA.',
    diff: {
      summary: { additions: 0, deletions: 0, net: 0 },
      changes: [],
      recommendation: 'Generez un brouillon pour obtenir la synthese de risques CCJA.',
    },
    riskLevel: 'low',
    citations: [
      {
        title: 'AUSCGIE 2014 - Article 10',
        url: 'https://www.ohada.org/wp-content/uploads/2023/01/auscgie-2014.pdf',
        binding: true,
      },
    ],
  },
];

const FALLBACK_EXPORTS: DraftExportMeta[] = [
  { format: 'markdown', status: 'pending' },
  { format: 'pdf', status: 'pending' },
  { format: 'docx', status: 'pending' },
];

export function DraftingView({ messages, locale }: DraftingViewProps) {
  const [prompt, setPrompt] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastDraft, setLastDraft] = useState<DraftGenerationResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DraftTemplate | null>(null);
  const [fillInsEditor, setFillInsEditor] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const templatesQuery = useQuery({
    queryKey: ['drafting-templates', DEMO_ORG_ID],
    queryFn: () => fetchDraftingTemplates(DEMO_ORG_ID, undefined, DEMO_USER_ID),
  });

  const templates = useMemo<DraftTemplate[]>(() => {
    const rows = (templatesQuery.data?.templates ?? []) as DraftTemplate[];
    return rows.map((template) => ({
      ...template,
      matterType: template.matterType ?? 'assignation',
      fillIns: template.fillIns ?? [],
      sections: template.sections ?? null,
    }));
  }, [templatesQuery.data]);

  const templatesByCategory = useMemo(() => {
    const map = new Map<string, DraftTemplate[]>();
    for (const template of templates) {
      const key = template.matterType ?? 'assignation';
      const existing = map.get(key) ?? [];
      existing.push(template);
      map.set(key, existing);
    }
    return map;
  }, [templates]);

  const isTemplatesLoading = templatesQuery.isLoading;
  const templatesError = templatesQuery.isError;

  const mutation = useMutation({
    mutationFn: async (input: { prompt: string }) => {
      return createDraft({
        orgId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
        prompt: input.prompt,
        title: fileName ?? selectedTemplate?.title ?? undefined,
        jurisdiction: selectedTemplate?.jurisdiction,
        matterType: selectedTemplate?.matterType,
        templateId: selectedTemplate?.id,
        fillIns: parsedFillIns,
        context: additionalContext.trim() || undefined,
      });
    },
    onSuccess: (draft) => {
      setLastDraft(draft);
      toast.success(locale === 'fr' ? 'Brouillon généré' : 'Draft generated', {
        description: `${draft.preview}${draft.preview.length >= 120 ? '…' : ''}`,
      });
      setPrompt('');
      setFileName(null);
      setAdditionalContext('');
      setFillInsEditor(selectedTemplate ? (selectedTemplate.fillIns ?? []).join('\n') : '');
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Erreur de génération' : 'Generation failed');
    },
  });

  const clauseComparisons = lastDraft?.clauseComparisons ?? FALLBACK_CLAUSE_COMPARISONS;
  const exportsMeta = lastDraft?.exports ?? FALLBACK_EXPORTS;
  const iracPayload = lastDraft?.structuredPayload ?? null;
  const planSteps = lastDraft?.plan ?? [];
  const trustPanel = lastDraft?.trustPanel ?? null;
  const verification = lastDraft?.verification ?? null;
  const parsedFillIns = useMemo(() => {
    return fillInsEditor
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, [fillInsEditor]);

  function handleExportClick() {
    const lines = exportsMeta
      .map((entry) => {
        const label = entry.format.toUpperCase();
        if (entry.status !== 'ready') {
          return `${label}: ${locale === 'fr' ? 'en attente' : 'pending'}`;
        }
        const location = entry.storagePath ? ` → ${entry.storagePath}` : '';
        return `${label}: ${locale === 'fr' ? 'prêt' : 'ready'}${location}`;
      })
      .join('\n');
    toast.info(locale === 'fr' ? 'Exports' : 'Exports', {
      description: lines,
    });
  }

  function handleSmartDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let effectivePrompt = prompt.trim();
    if (!effectivePrompt) {
      effectivePrompt = additionalContext.trim();
    }
    if (!effectivePrompt && selectedTemplate) {
      effectivePrompt = `${messages.drafting.selectedTemplate}: ${selectedTemplate.title}`;
    }
    if (!effectivePrompt && fileName) {
      effectivePrompt = `${locale === 'fr' ? 'Document téléversé' : 'Uploaded document'}: ${fileName}`;
    }
    if (!effectivePrompt) {
      toast.error(
        locale === 'fr'
          ? 'Ajoutez un prompt, un contexte ou un document.'
          : 'Provide a prompt, context, or upload a document.',
      );
      return;
    }
    mutation.mutate({ prompt: effectivePrompt });
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(messages.drafting.templateCategories).map(([key, label]) => {
          const templatesForCategory = templatesByCategory.get(key) ?? [];
          return (
            <Card key={key} className="glass-card border border-slate-800/60">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base uppercase tracking-wide text-slate-200">
                  {label}
                  <Badge variant="outline" className="bg-slate-900/40 text-xs uppercase text-teal-200">
                    {templatesForCategory.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTemplatesLoading ? (
                  <p className="text-sm text-slate-500">{messages.drafting.loading}</p>
                ) : templatesForCategory.length === 0 ? (
                  <p className="text-sm text-slate-500">{messages.drafting.empty}</p>
                ) : (
                  templatesForCategory.map((template) => {
                    const isSelected = selectedTemplate?.id === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`focus-ring w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-teal-400/80 bg-slate-900/80 text-teal-100'
                            : 'border-slate-800/60 bg-slate-900/60 hover:border-teal-400/80 hover:text-teal-100'
                        }`}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setFillInsEditor((template.fillIns ?? []).join('\n'));
                          toast.info(template.title, {
                            description: template.summary ?? messages.drafting.templateSummaryFallback,
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                          <Badge variant="outline" className="text-[10px] uppercase text-slate-300">
                            {template.jurisdiction}
                          </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {template.summary ?? messages.drafting.templateSummaryFallback}
                      </p>
                      {template.fillIns && template.fillIns.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {template.fillIns.slice(0, 3).map((fill) => (
                            <span
                              key={`${template.id}-${fill}`}
                              className="rounded-full border border-teal-400/30 bg-slate-900/80 px-2 py-1 text-[10px] uppercase tracking-wide text-teal-200"
                            >
                              {fill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                        <div className="mt-3 flex justify-end">
                          <Button size="sm" variant={isSelected ? 'default' : 'outline'}>
                            {isSelected ? messages.drafting.templateSelected : messages.drafting.templateSelect}
                          </Button>
                        </div>
                      </button>
                    );
                  })
                )}
                {templatesError ? (
                  <p className="text-xs text-rose-400">{messages.drafting.templatesError}</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.drafting.smartDraft}</CardTitle>
            <p className="text-sm text-slate-400">{messages.drafting.smartDraftDescription}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSmartDraft}>
              {selectedTemplate ? (
                <div className="rounded-2xl border border-teal-400/40 bg-slate-900/60 p-4 text-sm text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-teal-200">
                        {messages.drafting.selectedTemplate}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">{selectedTemplate.title}</p>
                      <p className="text-xs text-slate-400">
                        {selectedTemplate.summary ?? messages.drafting.templateSummaryFallback}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTemplate(null);
                        setFillInsEditor('');
                      }}
                    >
                      {messages.drafting.clearTemplate}
                    </Button>
                  </div>
                  {selectedTemplate.sections && selectedTemplate.sections.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {selectedTemplate.sections.map((section, index) => {
                        const heading =
                          typeof section.heading === 'string' && section.heading.trim().length > 0
                            ? section.heading.trim()
                            : `${messages.drafting.sectionFallback} ${index + 1}`;
                        const body =
                          typeof section.body === 'string' && section.body.trim().length > 0
                            ? section.body.trim()
                            : messages.drafting.sectionBodyFallback;
                        return (
                          <div key={`${selectedTemplate.id}-${heading}-${index}`}>
                            <p className="text-xs font-semibold text-slate-200">{heading}</p>
                            <p className="text-xs text-slate-400">{body}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className="block text-sm font-medium text-slate-300" htmlFor="draft-upload">
                {messages.drafting.uploadLabel}
              </label>
              <Input
                id="draft-upload"
                type="file"
                accept=".doc,.docx,.pdf,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setFileName(file ? file.name : null);
                }}
              />
              <p className="text-xs text-slate-500">{messages.drafting.or}</p>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                placeholder={messages.drafting.promptPlaceholder}
              />
              <label className="block text-sm font-medium text-slate-300" htmlFor="draft-context">
                {messages.drafting.additionalContext}
              </label>
              <Textarea
                id="draft-context"
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value)}
                rows={3}
                placeholder={messages.drafting.additionalContextPlaceholder}
              />
              <label className="block text-sm font-medium text-slate-300" htmlFor="draft-fillins">
                {messages.drafting.fillInsLabel}
              </label>
              <Textarea
                id="draft-fillins"
                value={fillInsEditor}
                onChange={(event) => setFillInsEditor(event.target.value)}
                rows={3}
                placeholder={messages.drafting.fillInsPlaceholder}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {fileName ? `${locale === 'fr' ? 'Document sélectionné' : 'Selected file'}: ${fileName}` : null}
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (locale === 'fr' ? 'Analyse…' : 'Processing…') : messages.drafting.generate}
                </Button>
              </div>
            </form>
            {lastDraft ? (
              <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-300">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-slate-100">{lastDraft.title}</p>
                  <span className="text-xs text-slate-500">SHA-256: {lastDraft.contentSha256.slice(0, 12)}…</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-400">{lastDraft.preview}</p>
                {lastDraft.risk ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Badge
                      variant="outline"
                      className={
                        lastDraft.risk.level === 'HIGH'
                          ? 'border-rose-500/50 text-rose-200'
                          : lastDraft.risk.level === 'MEDIUM'
                          ? 'border-amber-400/50 text-amber-200'
                          : 'border-teal-400/50 text-teal-200'
                      }
                    >
                      {locale === 'fr' ? 'Risque' : 'Risk'}: {lastDraft.risk.level}
                    </Badge>
                    {lastDraft.verification?.status === 'hitl_escalated' ? (
                      <span className="text-rose-300">
                        {locale === 'fr' ? 'Escalade HITL requise' : 'HITL escalation required'}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {iracPayload ? (
                  <div className="mt-4 space-y-2 text-xs text-slate-300">
                    <h4 className="text-sm font-semibold text-slate-100">{messages.drafting.iracHeader}</h4>
                    <div>
                      <p className="font-semibold text-slate-200">{messages.drafting.irac.question}</p>
                      <p className="text-slate-400">{iracPayload.issue}</p>
                    </div>
                    {iracPayload.rules.length > 0 ? (
                      <div>
                        <p className="font-semibold text-slate-200">{messages.drafting.irac.rules}</p>
                        <ul className="ml-4 list-disc text-slate-400">
                          {iracPayload.rules.map((rule: IracRule) => (
                            <li key={rule.source_url}>
                              {rule.citation} • {rule.effective_date} • {rule.source_url}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="font-semibold text-slate-200">{messages.drafting.irac.application}</p>
                      <p className="text-slate-400">{iracPayload.application}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{messages.drafting.irac.conclusion}</p>
                      <p className="text-slate-400">{iracPayload.conclusion}</p>
                    </div>
                  </div>
                ) : null}
                {verification && verification.notes?.length ? (
                  <div className="mt-4 space-y-1 text-xs text-slate-300">
                    <h4 className="text-sm font-semibold text-slate-100">{messages.drafting.verificationHeader}</h4>
                    {verification.notes.map((note) => (
                      <p key={note.code} className="text-slate-400">
                        ({note.severity}) {note.message}
                      </p>
                    ))}
                  </div>
                ) : null}
                {trustPanel ? (
                  <div className="mt-4 space-y-1 text-xs text-slate-300">
                    <h4 className="text-sm font-semibold text-slate-100">{messages.drafting.trustPanelHeader}</h4>
                    {trustPanel.citationSummary ? (
                      <p className="text-slate-400">
                        {messages.drafting.citationSummary}:{' '}
                        {trustPanel.citationSummary.allowlisted}/{trustPanel.citationSummary.total}
                      </p>
                    ) : null}
                    {trustPanel.provenance ? (
                      <p className="text-slate-400">
                        {messages.drafting.provenance}:{' '}
                        {trustPanel.provenance.residencyBreakdown
                          .map((entry) => `${entry.zone}:${entry.count}`)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {planSteps.length > 0 ? (
                  <div className="mt-4 space-y-1 text-xs text-slate-300">
                    <h4 className="text-sm font-semibold text-slate-100">{messages.drafting.planHeader}</h4>
                    <ol className="ml-4 list-decimal text-slate-400">
                      {planSteps.map((step, index) => {
                        const label = step?.name ?? `${messages.drafting.sectionFallback} ${index + 1}`;
                        return <li key={`${step?.id ?? index}`}>{label}</li>;
                      })}
                    </ol>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                  <span>{locale === 'fr' ? 'Exports' : 'Exports'}:</span>
                  {exportsMeta.map((entry) => (
                    <span key={`${entry.format}-${entry.status}`} className="rounded-full border border-slate-700/80 px-2 py-1 text-slate-300">
                      {entry.format.toUpperCase()} • {entry.status === 'ready' ? (locale === 'fr' ? 'prêt' : 'ready') : locale === 'fr' ? 'en attente' : 'pending'}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.drafting.clauseLibrary}</CardTitle>
            <p className="text-sm text-slate-400">{messages.drafting.clauseBenchmark}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {clauseComparisons.map((clause) => (
              <button
                key={clause.clauseId}
                type="button"
                className="focus-ring w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-left transition hover:border-teal-400/60 hover:text-teal-100"
                onClick={() =>
                  toast.info(clause.title, {
                    description: clause.diff.recommendation,
                  })
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{clause.title}</p>
                  <Badge variant="outline" className="text-[10px] uppercase text-slate-300">
                    {clause.riskLevel}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{clause.rationale}</p>
                {clause.citations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {clause.citations.map((citation) => (
                      <a
                        key={`${clause.clauseId}-${citation.url}`}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring inline-flex items-center rounded-full border border-teal-400/40 bg-slate-900/80 px-3 py-1 text-xs text-teal-200"
                      >
                        {citation.title}
                      </a>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{messages.drafting.redline}</h2>
            <p className="text-sm text-slate-400">{messages.drafting.redlineDescription}</p>
          </div>
          <Button variant="outline" onClick={handleExportClick}>
            {messages.drafting.export}
          </Button>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {trustPanel ? (
            <div className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wide text-slate-400">{messages.drafting.trustPanelHeader}</p>
              {trustPanel.risk ? (
                <p className="mt-2 text-sm text-slate-200">
                  {messages.drafting.hitlFlag}:{' '}
                  {trustPanel.risk.hitlRequired ? messages.drafting.hitlYes : messages.drafting.hitlNo}
                </p>
              ) : null}
              {trustPanel.citationSummary ? (
                <p className="mt-1 text-xs text-slate-400">
                  {messages.drafting.citationSummary}:{' '}
                  {trustPanel.citationSummary.allowlisted}/{trustPanel.citationSummary.total}
                </p>
              ) : null}
              {trustPanel.provenance ? (
                <p className="mt-1 text-xs text-slate-400">
                  {messages.drafting.residencyBreakdown}:{' '}
                  {trustPanel.provenance.residencyBreakdown
                    .map((entry) => `${entry.zone}:${entry.count}`)
                    .join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
          {clauseComparisons.map((clause) => (
            <div key={clause.clauseId} className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avant</p>
              <p className="mt-1 text-sm text-slate-300">{clause.baseline}</p>
              <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">Après</p>
              <p className="mt-1 text-sm text-emerald-200">{clause.proposed}</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">{clause.diff.recommendation}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    toast.info(clause.title, {
                      description: `${clause.rationale}\n\n${clause.diff.recommendation}`,
                    })
                  }
                >
                  {messages.drafting.explain}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
