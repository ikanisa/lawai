'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { cn } from '@/lib/utils';
import { useResearchSearch, type ResearchSearchResult } from './use-research-search';

interface AttributeOption {
  value: string;
  label: string;
  description?: string;
}

const DEFAULT_ATTRIBUTE_OPTIONS: AttributeOption[] = [
  { value: 'official', label: 'Officiel' },
  { value: 'jurisprudence', label: 'Jurisprudence' },
  { value: 'doctrine', label: 'Doctrine' },
];

interface SearchPanelProps {
  initialQuery?: string;
  initialScoreThreshold?: number;
  initialAttributes?: string[];
  initialRewrite?: boolean;
  attributeOptions?: AttributeOption[];
}

function clampScoreThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function ResultList({ results }: { results: ResearchSearchResult[] }) {
  if (results.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">No results found.</p>;
  }

  return (
    <ul aria-label="Search results" className="mt-4 space-y-3">
      {results.map((result) => (
        <li key={result.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">{result.title}</h3>
            <span className="text-xs font-semibold text-slate-400">{Math.round(result.score)}%</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.summary}</p>
          {result.attributes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.attributes.map((attribute) => (
                <span
                  key={`${result.id}-${attribute}`}
                  className="rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300"
                >
                  {attribute}
                </span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SearchPanel({
  initialQuery = '',
  initialScoreThreshold = 60,
  initialAttributes = [],
  initialRewrite = false,
  attributeOptions = DEFAULT_ATTRIBUTE_OPTIONS,
}: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [scoreThreshold, setScoreThreshold] = useState(() => clampScoreThreshold(initialScoreThreshold));
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(() => [...new Set(initialAttributes)]);
  const [rewriteEnabled, setRewriteEnabled] = useState(initialRewrite);

  const searchParams = useMemo(
    () => ({
      query,
      scoreThreshold,
      attributes: selectedAttributes,
      rewrite: rewriteEnabled,
    }),
    [query, rewriteEnabled, scoreThreshold, selectedAttributes],
  );

  const searchQuery = useResearchSearch(searchParams);

  function handleQueryChange(event: FormEvent<HTMLInputElement>) {
    setQuery(event.currentTarget.value);
  }

  function handleScoreThresholdChange(event: FormEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.currentTarget.value, 10);
    setScoreThreshold(clampScoreThreshold(Number.isNaN(value) ? 0 : value));
  }

  function toggleAttribute(value: string) {
    setSelectedAttributes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function handleRewriteToggle() {
    setRewriteEnabled((previous) => !previous);
  }

  const resultList = searchQuery.data?.results ?? [];

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-inner"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Query</span>
          <Input value={query} placeholder="Search legislation" onChange={handleQueryChange} />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score threshold</span>
            <Input type="number" min={0} max={100} step={1} value={scoreThreshold} onChange={handleScoreThresholdChange} />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rewrite query</span>
            <Switch
              type="button"
              checked={rewriteEnabled}
              onClick={handleRewriteToggle}
              label={rewriteEnabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">Attribute filters</legend>
          <div className="flex flex-wrap gap-2">
            {attributeOptions.length === 0 ? (
              <span className="text-xs text-slate-500">No attribute filters available.</span>
            ) : (
              attributeOptions.map((option) => {
                const active = selectedAttributes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition',
                      active
                        ? 'bg-grad-1 text-slate-900 shadow-lg'
                        : 'text-slate-300 hover:border-slate-500 hover:text-slate-100',
                    )}
                    onClick={() => toggleAttribute(option.value)}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </fieldset>
      </form>

      <section className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Results</h2>
          {searchQuery.isFetching ? (
            <span className="text-xs text-slate-500">Updating…</span>
          ) : null}
        </header>

        {searchQuery.isLoading && resultList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Loading results…</p>
        ) : (
          <ResultList results={resultList} />
        )}
      </section>
    </div>
  );
}
