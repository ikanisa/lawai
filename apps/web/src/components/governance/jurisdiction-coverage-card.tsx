'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '.@/ui/card';
import { Badge } from '.@/ui/badge';
import type { Messages } from '../@/lib/i18n';
import type { GovernanceMetricsResponse } from '../@/lib/api';
import { SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';

interface JurisdictionCoverageCardProps {
  messages: Messages;
  data: GovernanceMetricsResponse['jurisdictions'];
  loading?: boolean;
}

function percent(value: number, total: number): string {
  if (total <= 0) return '—';
  return `${Math.round((value / total) * 100)} %`;
}

function coverageVariant(ratio: number | null): 'success' | 'warning' | 'danger' | 'outline' {
  if (ratio === null) return 'outline';
  if (ratio >= 0.9) return 'success';
  if (ratio >= 0.6) return 'warning';
  return 'danger';
}

export function JurisdictionCoverageCard({ messages, data, loading = false }: JurisdictionCoverageCardProps) {
  const coverageMessages = messages.admin.compliance;
  const jurisdictionLabels = useMemo(
    () =>
      new Map(
        SUPPORTED_JURISDICTIONS.map((entry: (typeof SUPPORTED_JURISDICTIONS)[number]) => [
          entry.id,
          entry.labelFr,
        ]),
      ),
    [],
  );

  const rows = useMemo(() => {
    const withLabels = data.map(
      (row) =>
        ({
          ...row,
          label: jurisdictionLabels.get(row.jurisdiction) ?? row.jurisdiction,
        }) as GovernanceMetricsResponse['jurisdictions'][number] & { label: string },
    );
    return withLabels.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [data, jurisdictionLabels]);

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{coverageMessages.title}</CardTitle>
        <p className="text-sm text-slate-400">{coverageMessages.description}</p>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-400">…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">{coverageMessages.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/60 text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide">
                    {coverageMessages.jurisdiction}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide">
                    {coverageMessages.residency}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    {coverageMessages.sources}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    {coverageMessages.binding}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    {coverageMessages.consolidated}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    {coverageMessages.language}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    {coverageMessages.identifiers}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {rows.map((row) => {
                  const total = row.totalSources;
                  const bindingPercent = percent(row.sourcesWithBinding, total);
                  const consolidatedPercent = percent(row.sourcesConsolidated, total);
                  const languagePercent = percent(row.sourcesWithLanguageNote, total);
                  const identifiersPercent = percent(row.sourcesWithEli + row.sourcesWithEcli, total);
                  const bindingRatio = total > 0 ? row.sourcesWithBinding / total : null;
                  const consolidatedRatio = total > 0 ? row.sourcesConsolidated / total : null;
                  const languageRatio = total > 0 ? row.sourcesWithLanguageNote / total : null;
                  const identifiersRatio =
                    total > 0 ? (row.sourcesWithEli + row.sourcesWithEcli) / total : null;
                  const isRwanda = row.jurisdiction === 'RW';
                  return (
                    <tr key={row.jurisdiction} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-100">{row.label}</span>
                          {isRwanda ? <Badge variant="success">RW</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.residencyZone ? (
                          <Badge variant="outline" className="text-xs text-slate-200">
                            {row.residencyZone}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">{total}</td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        <Badge variant={coverageVariant(bindingRatio)}>{bindingPercent}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        <Badge variant={coverageVariant(consolidatedRatio)}>{consolidatedPercent}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        <Badge variant={coverageVariant(languageRatio)}>{languagePercent}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        <Badge variant={coverageVariant(identifiersRatio)}>{identifiersPercent}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
