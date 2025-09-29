'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { Messages } from '../../lib/i18n';
import type { GovernanceMetricsResponse } from '../../lib/api';
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

export function JurisdictionCoverageCard({ messages, data, loading = false }: JurisdictionCoverageCardProps) {
  const coverageMessages = messages.admin.compliance;
  const jurisdictionLabels = useMemo(() => new Map(SUPPORTED_JURISDICTIONS.map((entry) => [entry.id, entry.labelFr])), []);

  const rows = useMemo(
    () =>
      [...data]
        .map((row) => ({
          ...row,
          label: jurisdictionLabels.get(row.jurisdiction) ?? row.jurisdiction,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [data, jurisdictionLabels],
  );

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
                  const isRwanda = row.jurisdiction === 'RW';
                  return (
                    <tr key={row.jurisdiction} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-100">{row.label}</span>
                          {isRwanda ? <Badge variant="success">RW</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.residencyZone || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{total}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{bindingPercent}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{consolidatedPercent}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{languagePercent}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{identifiersPercent}</td>
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
