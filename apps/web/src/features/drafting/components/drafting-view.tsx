'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Badge } from '@/ui/badge';
import type { Locale, Messages } from '@/lib/i18n';
import { queryKeys } from '@/lib/query';
import { DEMO_ORG_ID, fetchDraftingTemplates } from '@/lib/api';
import { RedlineDiff, type RedlineEntry } from './redline-diff';

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

const CLAUSE_LIBRARY = [
  {
    id: 'clause-noncompete-ma',
    title: 'Clause de non-concurrence – Maroc',
    rationale: 'Validité conditionnée à la durée, au périmètre et à l’indemnisation (Code du travail art. 61 bis).',
    citations: [
      'https://www.sgg.gov.ma/Portals/1/lois/Loi_travail_65-99.pdf',
      'https://www.courdecassation.ma/jurisprudence/social/2019-115',
    ],
  },
  {
    id: 'clause-hardship-ohada',
    title: 'Clause de hardship – OHADA',
    rationale: 'Anticiper les renégociations prévues par l’AUSCGIE et l’article 1134 du Code civil local.',
    citations: [
      'https://www.ohada.org/wp-content/uploads/2023/01/auscgie-2014.pdf',
    ],
  },
];

const REDLINE_DIFF: RedlineEntry[] = [
  {
    id: 'r1',
    title: 'Garantie produits',
    original:
      'Le Fournisseur garantit la conformité des produits pour une durée de douze (12) mois à compter de la livraison.',
    revised:
      'Le Fournisseur garantit la conformité des produits pour une durée de vingt-quatre (24) mois à compter de la livraison officielle, sous réserve des inspections de l’acheteur.',
    impact: 'Allonge la garantie – vérifier compatibilité avec le Code de la consommation (FR).',
    status: 'accepted',
    risk: 'medium',
    citations: ['https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046736859'],
  },
  {
    id: 'r2',
    title: 'Clause compromissoire',
    original: 'Tout litige sera soumis aux tribunaux de Paris.',
    revised: 'Tout litige sera soumis à la CCJA conformément à la clause compromissoire OHADA annexée.',
    impact: 'Modifie la juridiction compétente – nécessite consentement exprès des parties.',
    status: 'flagged',
    risk: 'high',
    citations: ['https://www.ohada.org/wp-content/uploads/2023/01/auscgie-2014.pdf'],
  },
  {
    id: 'r3',
    title: 'Indemnité de rupture',
    original: 'En cas de résiliation anticipée, aucune indemnité ne sera due.',
    revised: 'En cas de résiliation anticipée, une indemnité équivalente à trois (3) mois de prestations sera due.',
    impact: 'Introduit un coût supplémentaire — vérifier conformité avec le droit local du travail (OHADA/Maroc).',
    status: 'pending',
    risk: 'medium',
    citations: ['https://www.sgg.gov.ma/Portals/1/lois/Loi_travail_65-99.pdf'],
  },
];

export function DraftingView({ messages, locale }: DraftingViewProps) {
  const [prompt, setPrompt] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: queryKeys.drafting.list(DEMO_ORG_ID),
    queryFn: () => fetchDraftingTemplates(DEMO_ORG_ID),
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
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true };
    },
    onSuccess: () => {
      toast.success(locale === 'fr' ? 'Brouillon généré' : 'Draft generated');
      setPrompt('');
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Erreur de génération' : 'Generation failed');
    },
  });

  function handleSmartDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() && !fileName) {
      toast.error(locale === 'fr' ? 'Ajoutez un prompt ou un document.' : 'Provide a prompt or upload a document.');
      return;
    }
    mutation.mutate({ prompt });
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(messages.drafting.templateCategories).map(([key, label]) => {
          const templatesForCategory = templatesByCategory.get(key) ?? [];
          return (
            <Card key={key} className="glass-card border border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base uppercase tracking-wide text-muted-foreground">
                  {label}
                  <Badge variant="outline" className="bg-muted/40 text-xs uppercase text-primary">
                    {templatesForCategory.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTemplatesLoading ? (
                  <p className="text-sm text-muted-foreground/80">{messages.drafting.loading}</p>
                ) : templatesForCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground/80">{messages.drafting.empty}</p>
                ) : (
                  templatesForCategory.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="focus-ring w-full rounded-2xl border border-border/70 bg-muted/60 p-4 text-left transition hover:border-primary/80 hover:text-primary/80"
                      onClick={() =>
                        toast.info(template.title, {
                          description: template.summary ?? messages.drafting.templateSummaryFallback,
                        })
                      }
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{template.title}</p>
                        <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                          {template.jurisdiction}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.summary ?? messages.drafting.templateSummaryFallback}
                      </p>
                      {template.fillIns && template.fillIns.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {template.fillIns.slice(0, 3).map((fill) => (
                            <span
                              key={`${template.id}-${fill}`}
                              className="rounded-full border border-primary/40 bg-muted/80 px-2 py-1 text-[10px] uppercase tracking-wide text-primary"
                            >
                              {fill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))
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
        <Card className="glass-card border border-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">{messages.drafting.smartDraft}</CardTitle>
            <p className="text-sm text-muted-foreground">{messages.drafting.smartDraftDescription}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSmartDraft}>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="draft-upload">
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
              <p className="text-xs text-muted-foreground/80">{messages.drafting.or}</p>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                placeholder={messages.drafting.promptPlaceholder}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground/80">
                  {fileName ? `${locale === 'fr' ? 'Document sélectionné' : 'Selected file'}: ${fileName}` : null}
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (locale === 'fr' ? 'Analyse…' : 'Processing…') : messages.drafting.generate}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card border border-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">{messages.drafting.clauseLibrary}</CardTitle>
            <p className="text-sm text-muted-foreground">{messages.drafting.clauseBenchmark}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {CLAUSE_LIBRARY.map((clause) => (
              <div key={clause.id} className="rounded-2xl border border-border/70 bg-slate-900/50 p-4">
                <p className="text-sm font-semibold text-foreground">{clause.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">{clause.rationale}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {clause.citations.map((citation) => (
                    <a
                      key={citation}
                      href={citation}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex items-center rounded-full border border-teal-400/40 bg-muted/80 px-3 py-1 text-xs text-primary"
                    >
                      {messages.citationsBrowser.open}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{messages.drafting.redline}</h2>
            <p className="text-sm text-muted-foreground">{messages.drafting.redlineDescription}</p>
          </div>
          <Button variant="outline">{messages.drafting.export}</Button>
        </header>
        <RedlineDiff
          entries={REDLINE_DIFF}
          messages={messages.drafting.redlineViewer}
          onExplain={(entry) =>
            toast.info(messages.drafting.redlineViewer.explainToastTitle.replace('{title}', entry.title), {
              description: entry.impact,
            })
          }
        />
      </section>
    </div>
  );
}
