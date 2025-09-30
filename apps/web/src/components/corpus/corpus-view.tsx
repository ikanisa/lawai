'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import type { Locale, Messages } from '../../lib/i18n';
import { DEMO_ORG_ID, DEMO_USER_ID, fetchCorpus, toggleAllowlistDomain, sendTelemetryEvent, resummarizeDocument, uploadDocument, processDriveManifest } from '../../lib/api';

interface CorpusViewProps {
  messages: Messages;
  locale: Locale;
}

interface AllowlistDomain {
  jurisdiction: string;
  host: string;
  active: boolean;
  lastIngestedAt?: string | null;
}

interface SnapshotDocument {
  id: string;
  name: string;
  path: string;
  status?: string | null;
  createdAt?: string | null;
  summaryStatus?: string | null;
  summaryGeneratedAt?: string | null;
  summaryError?: string | null;
  chunkCount?: number | null;
  summary?: string | null;
  highlights?: Array<{ heading: string; detail: string }> | null;
}

interface UploadDocument {
  id: string;
  name: string;
  createdAt?: string;
}

interface IngestionRunRow {
  id: string;
  adapter: string;
  status: string;
  inserted: number;
  skipped: number;
  failed: number;
}

export function CorpusView({ messages, locale }: CorpusViewProps) {
  const queryClient = useQueryClient();
  const corpusQuery = useQuery({ queryKey: ['corpus'], queryFn: () => fetchCorpus(DEMO_ORG_ID) });

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [bucket, setBucket] = useState<'uploads' | 'authorities'>('uploads');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceJuris, setSourceJuris] = useState('');
  const [sourceType, setSourceType] = useState('statute');

  const toggleMutation = useMutation({
    mutationFn: ({ host, active, jurisdiction }: { host: string; active: boolean; jurisdiction?: string }) =>
      toggleAllowlistDomain(host, active, jurisdiction),
    onSuccess: (_data, variables) => {
      toast.success(locale === 'fr' ? 'Domaine mis à jour' : 'Domain updated');
      void sendTelemetryEvent('allowlist_toggled', {
        host: variables.host,
        active: variables.active,
        jurisdiction: variables.jurisdiction ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ['corpus'] });
    },
    onError: (_error, variables) => {
      toast.error(locale === 'fr' ? 'Échec de la mise à jour' : 'Update failed');
      if (variables) {
        void sendTelemetryEvent('allowlist_toggle_failed', {
          host: variables.host,
          active: variables.active,
          jurisdiction: variables.jurisdiction ?? null,
        });
      }
    },
  });

  const resummarizeMutation = useMutation<any, Error, string>({
    mutationFn: (documentId: string) => resummarizeDocument(DEMO_ORG_ID, documentId),
    onSuccess: (data) => {
      toast.success(messages.corpus.resummarizeSuccess);
      void sendTelemetryEvent('corpus_resummarize', { documentId: data.documentId, status: data.summaryStatus });
      queryClient.invalidateQueries({ queryKey: ['corpus'] });
    },
    onError: (_error, variables) => {
      toast.error(messages.corpus.resummarizeError);
      if (variables) {
        void sendTelemetryEvent('corpus_resummarize_failed', { documentId: variables });
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('no_file');
      const source =
        bucket === 'authorities'
          ? {
              jurisdiction_code: sourceJuris || 'FR',
              source_type: sourceType || 'statute',
              title: sourceTitle || file.name,
            }
          : null;
      return uploadDocument({ orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, file, bucket, source });
    },
    onSuccess: (data) => {
      toast.success(locale === 'fr' ? 'Fichier importé' : 'File uploaded');
      void sendTelemetryEvent('upload_completed', { documentId: data.documentId, bucket: data.bucket, bytes: data.bytes });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['corpus'] });
    },
    onError: (error) => {
      toast.error(locale === 'fr' ? "Échec de l'import" : 'Upload failed');
      void sendTelemetryEvent('upload_failed', { error: (error as Error).message });
    },
  });

  const [manifestUrl, setManifestUrl] = useState('');
  const manifestMutation = useMutation({
    mutationFn: () =>
      processDriveManifest({ orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, manifestUrl, manifestName: 'manifest.jsonl' }),
    onSuccess: (data) => {
      toast.success(locale === 'fr' ? 'Manifeste traité' : 'Manifest processed');
      void sendTelemetryEvent('drive_manifest_processed', data ?? {});
      queryClient.invalidateQueries({ queryKey: ['corpus'] });
    },
    onError: (error) => {
      toast.error(locale === 'fr' ? 'Échec du manifeste' : 'Manifest failed');
      void sendTelemetryEvent('drive_manifest_failed', { error: (error as Error).message });
    },
  });

  const statusVariant = (status?: string | null) => {
    const value = (status ?? 'pending').toLowerCase();
    if (value === 'ready') {
      return 'success' as const;
    }
    if (value === 'skipped') {
      return 'warning' as const;
    }
    if (value === 'failed') {
      return 'danger' as const;
    }
    return 'outline' as const;
  };

  const statusLabel = (status?: string | null) => {
    const value = (status ?? 'pending').toLowerCase();
    const labels = messages.corpus.status ?? {};
    return (labels as Record<string, string>)[value] ?? value;
  };

  const allowlist = useMemo<AllowlistDomain[]>(() => corpusQuery.data?.allowlist ?? [], [corpusQuery.data]);
  const snapshots = (corpusQuery.data?.snapshots ?? []) as SnapshotDocument[];
  const uploads = (corpusQuery.data?.uploads ?? []) as UploadDocument[];
  const ingestions = (corpusQuery.data?.ingestionRuns ?? []) as IngestionRunRow[];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {allowlist.map((domain) => (
          <Card key={`${domain.jurisdiction}-${domain.host}`} className="glass-card border border-slate-800/60">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-slate-100">
                {domain.host}
                <Badge variant={domain.active ? 'success' : 'outline'}>
                  {domain.active ? messages.corpus.active : messages.corpus.inactive}
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-400">{domain.jurisdiction}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-400">
              <p>
                {messages.corpus.lastRun}: {domain.lastIngestedAt ?? '—'}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ host: domain.host, active: !domain.active, jurisdiction: domain.jurisdiction })}
              >
                {messages.corpus.toggle}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.corpus.snapshots}</CardTitle>
            <Badge variant="outline">{messages.corpus.rwandaBadge}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {snapshots.map((doc) => {
              const highlights = Array.isArray(doc.highlights) ? doc.highlights : [];
              const status = doc.summaryStatus ?? 'pending';
              const isRefreshing = resummarizeMutation.isPending && resummarizeMutation.variables === doc.id;
              return (
                <div key={doc.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.path}</p>
                    </div>
                    <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400">
                    <p>
                      {messages.corpus.chunkCount}: {doc.chunkCount ?? 0}
                    </p>
                    <p>
                      {messages.corpus.lastSummary}:{' '}
                      {doc.summaryGeneratedAt ? new Date(doc.summaryGeneratedAt).toLocaleString(locale) : '—'}
                    </p>
                    <p>
                      {messages.corpus.ingestion}: {doc.status ?? '—'}
                    </p>
                  </div>
                  {doc.summary ? (
                    <div className="space-y-2 text-sm text-slate-100">
                      <p>{doc.summary}</p>
                      {highlights.length > 0 ? (
                        <div className="space-y-1 text-xs text-slate-300">
                          <p className="font-semibold uppercase tracking-wide text-slate-200">
                            {messages.corpus.summaryHighlights}
                          </p>
                          <ul className="list-disc space-y-1 pl-5">
                            {highlights.map((item, index) => (
                              <li key={`${doc.id}-highlight-${index}`} className="text-slate-300">
                                <span className="font-semibold text-slate-100">{item.heading}: </span>
                                <span>{item.detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{messages.corpus.noSummary}</p>
                  )}
                  {doc.summaryError ? (
                    <p className="text-xs text-legal-red">{messages.corpus.summaryErrorPrefix}{doc.summaryError}</p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRefreshing}
                      onClick={() => resummarizeMutation.mutate(doc.id)}
                    >
                      {isRefreshing ? messages.corpus.resummarizeInFlight : messages.corpus.resummarize}
                    </Button>
                  </div>
                </div>
              );
            })}
            {snapshots.length === 0 ? (
              <p className="text-sm text-slate-500">{messages.corpus.noSnapshots}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.corpus.uploads}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 space-y-3">
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  aria-label={locale === 'fr' ? 'Sélectionner un fichier' : 'Select file'}
                  className="text-xs text-slate-300"
                />
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bucket"
                      checked={bucket === 'uploads'}
                      onChange={() => setBucket('uploads')}
                    />
                    <span>uploads</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bucket"
                      checked={bucket === 'authorities'}
                      onChange={() => setBucket('authorities')}
                    />
                    <span>authorities</span>
                  </label>
                </div>
                {bucket === 'authorities' ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      placeholder={locale === 'fr' ? 'Juridiction (ex: FR, OHADA, RW)' : 'Jurisdiction (e.g., FR, OHADA, RW)'}
                      value={sourceJuris}
                      onChange={(e) => setSourceJuris(e.target.value.toUpperCase())}
                      className="rounded-md bg-slate-800/60 p-2 text-xs text-slate-200 outline-none border border-slate-700"
                    />
                    <input
                      placeholder={locale === 'fr' ? 'Type (statute/case/gazette)' : 'Type (statute/case/gazette)'}
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className="rounded-md bg-slate-800/60 p-2 text-xs text-slate-200 outline-none border border-slate-700"
                    />
                    <input
                      placeholder={locale === 'fr' ? 'Titre (optionnel)' : 'Title (optional)'}
                      value={sourceTitle}
                      onChange={(e) => setSourceTitle(e.target.value)}
                      className="rounded-md bg-slate-800/60 p-2 text-xs text-slate-200 outline-none border border-slate-700"
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!file || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
                    {uploadMutation.isPending ? (locale === 'fr' ? 'Import…' : 'Uploading…') : (locale === 'fr' ? 'Importer' : 'Upload')}
                  </Button>
                  {file ? <span className="text-xs text-slate-400">{file.name}</span> : null}
                </div>
              </div>
            </div>
            {uploads.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <p className="font-semibold text-slate-100">{doc.name}</p>
                <p className="text-xs text-slate-400">{doc.createdAt}</p>
              </div>
            ))}
            {uploads.length === 0 ? (
              <p className="text-sm text-slate-500">{messages.corpus.noUploads}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.corpus.telemetry}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-400">
            {ingestions.map((run) => (
              <div key={run.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200">{run.adapter}</span>
                  <Badge variant={run.status === 'completed' ? 'success' : 'warning'}>{run.status}</Badge>
                </div>
                <p>
                  {messages.corpus.ingestion}: +{run.inserted} / {run.skipped} ignorés / {run.failed} échecs
                </p>
              </div>
            ))}
            {ingestions.length === 0 ? (
              <p className="text-sm text-slate-500">{messages.corpus.ingestion}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Google Drive – {locale === 'fr' ? 'Traitement de manifeste' : 'Process Manifest'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <div className="grid gap-2 md:grid-cols-3">
              <input
                placeholder={locale === 'fr' ? 'URL du manifeste (JSON/JSONL)' : 'Manifest URL (JSON/JSONL)'}
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                className="rounded-md bg-slate-800/60 p-2 text-xs text-slate-200 outline-none border border-slate-700"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!manifestUrl || manifestMutation.isPending}
                onClick={() => manifestMutation.mutate()}
              >
                {manifestMutation.isPending ? (locale === 'fr' ? 'Traitement…' : 'Processing…') : (locale === 'fr' ? 'Traiter' : 'Process')}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              {locale === 'fr'
                ? "Le manifeste est validé via la fonction Edge `drive-watcher` et les résultats (erreurs/avertissements) sont journalisés."
                : 'The manifest is validated via the `drive-watcher` Edge function and results are logged.'}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
