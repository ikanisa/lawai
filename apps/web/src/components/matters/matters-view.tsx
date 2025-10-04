"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus,
  CheckCircle2,
  Download,
  Edit2,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { Sheet, SheetSection } from '../../components/ui/sheet';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import type { Locale, Messages } from '../../lib/i18n';
import {
  DEMO_ORG_ID,
  createMatter,
  deleteMatter,
  fetchMatterCalendar,
  fetchMatterDetail,
  fetchMatters,
  MatterCalendarSettings,
  MatterDetailResponse,
  MatterSummary,
  previewMatterDeadlines,
  updateMatter,
} from '../../lib/api';

interface MattersViewProps {
  messages: Messages;
  locale: Locale;
}

type FormState = {
  title: string;
  description: string;
  jurisdiction: string;
  procedure: string;
  status: string;
  riskLevel: string;
  hitlRequired: boolean;
  filingDate: string;
  decisionDate: string;
  calendarType: MatterCalendarSettings['type'];
  calendarTimezone: string;
  calendarMethod: MatterCalendarSettings['method'];
};

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  jurisdiction: '',
  procedure: '',
  status: 'open',
  riskLevel: 'MEDIUM',
  hitlRequired: false,
  filingDate: '',
  decisionDate: '',
  calendarType: 'calendar',
  calendarTimezone: 'Europe/Paris',
  calendarMethod: 'standard',
};

export function MattersView({ messages, locale }: MattersViewProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM);
  const [deadlinePreview, setDeadlinePreview] = useState<
    Array<{ name: string; dueAt: string; ruleReference: string; notes: string }>
  >([]);
  const [previewNotes, setPreviewNotes] = useState<{ method: string; calendar: string } | null>(null);

  const mattersQuery = useQuery({
    queryKey: ['matters'],
    queryFn: () => fetchMatters(DEMO_ORG_ID),
  });

  const detailQuery = useQuery({
    queryKey: ['matter', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchMatterDetail(DEMO_ORG_ID, selectedId ?? ''),
  });

  useEffect(() => {
    if (!selectedId && mattersQuery.data?.matters?.length) {
      setSelectedId(mattersQuery.data.matters[0].id);
    }
  }, [mattersQuery.data, selectedId]);

  const matters = useMemo<MatterSummary[]>(() => {
    const rows = mattersQuery.data?.matters ?? [];
    if (!filter.trim()) return rows;
    const lower = filter.toLowerCase();
    return rows.filter((matter) => matter.title.toLowerCase().includes(lower));
  }, [mattersQuery.data, filter]);

  const statusChip = (status?: string | null) => {
    if (!status) return null;
    const normalized = status.toLowerCase();
    const label = messages.matters.status[normalized as keyof typeof messages.matters.status] ?? status;
    const variant = normalized === 'closed' ? 'default' : normalized === 'review' ? 'warning' : 'outline';
    return (
      <Badge variant={variant} className="uppercase tracking-wide">
        {label}
      </Badge>
    );
  };

  const riskBadge = (risk?: string | null) => {
    if (!risk) return null;
    const normalized = risk.toUpperCase();
    const variant = normalized === 'HIGH' ? 'danger' : normalized === 'MEDIUM' ? 'warning' : 'outline';
    return (
      <Badge variant={variant} className="uppercase tracking-wide">
        {normalized}
      </Badge>
    );
  };

  const detail = detailQuery.data ?? null;

  const previewMutation = useMutation({
    mutationFn: previewMatterDeadlines,
    onSuccess: (result) => {
      setDeadlinePreview(result.deadlines);
      setPreviewNotes(result.notes);
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Impossible de calculer le calendrier' : 'Unable to compute schedule');
    },
  });

  const createMutation = useMutation({
    mutationFn: createMatter,
    onSuccess: async (data) => {
      toast.success(locale === 'fr' ? 'Dossier créé' : 'Matter created');
      await queryClient.invalidateQueries({ queryKey: ['matters'] });
      setSelectedId(data.matter.id);
      setIsSheetOpen(false);
      setDeadlinePreview([]);
      setPreviewNotes(null);
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Création impossible' : 'Unable to create matter');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateMatter>[1] }) =>
      updateMatter(id, payload),
    onSuccess: async (data) => {
      toast.success(locale === 'fr' ? 'Dossier mis à jour' : 'Matter updated');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matters'] }),
        queryClient.invalidateQueries({ queryKey: ['matter', data.matter.id] }),
      ]);
      setIsSheetOpen(false);
      setDeadlinePreview([]);
      setPreviewNotes(null);
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Mise à jour impossible' : 'Unable to update matter');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMatter(DEMO_ORG_ID, id),
    onSuccess: async () => {
      toast.success(locale === 'fr' ? 'Dossier supprimé' : 'Matter deleted');
      await queryClient.invalidateQueries({ queryKey: ['matters'] });
      setSelectedId(null);
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Suppression impossible' : 'Unable to delete matter');
    },
  });

  const calendarMutation = useMutation({
    mutationFn: (id: string) => fetchMatterCalendar(DEMO_ORG_ID, id),
    onSuccess: (data, id) => {
      const downloadUrl = data.calendarUrl ?? createObjectUrl(data.calendar);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `matter-${id}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (!data.calendarUrl) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2_000);
      }
      toast.success(locale === 'fr' ? 'Calendrier exporté' : 'Calendar exported');
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Export impossible' : 'Unable to export calendar');
    },
  });

  const openCreateSheet = () => {
    setSheetMode('create');
    setFormState(DEFAULT_FORM);
    setDeadlinePreview([]);
    setPreviewNotes(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = () => {
    if (!detail) return;
    setSheetMode('edit');
    const calendar = detail.calendarSettings;
    setFormState({
      title: detail.matter.title,
      description: detail.matter.description ?? '',
      jurisdiction: detail.matter.jurisdiction ?? '',
      procedure: detail.matter.procedure ?? '',
      status: detail.matter.status ?? 'open',
      riskLevel: detail.matter.riskLevel ?? 'MEDIUM',
      hitlRequired: detail.matter.hitlRequired,
      filingDate: detail.matter.filingDate ?? '',
      decisionDate: detail.matter.decisionDate ?? '',
      calendarType: calendar.type,
      calendarTimezone: calendar.timezone,
      calendarMethod: calendar.method,
    });
    setDeadlinePreview([]);
    setPreviewNotes(null);
    setIsSheetOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      orgId: DEMO_ORG_ID,
      title: formState.title,
      description: formState.description || null,
      jurisdiction: formState.jurisdiction || null,
      procedure: formState.procedure || null,
      status: formState.status,
      riskLevel: formState.riskLevel,
      hitlRequired: formState.hitlRequired,
      filingDate: formState.filingDate || null,
      decisionDate: formState.decisionDate || null,
      calendarType: formState.calendarType,
      calendarTimezone: formState.calendarTimezone,
      calendarMethod: formState.calendarMethod,
    };

    if (sheetMode === 'create') {
      createMutation.mutate(payload);
    } else if (selectedId) {
      updateMutation.mutate({ id: selectedId, payload });
    }
  };

  const handlePreview = () => {
    previewMutation.mutate({
      orgId: DEMO_ORG_ID,
      jurisdiction: formState.jurisdiction || undefined,
      procedure: formState.procedure || undefined,
      filingDate: formState.filingDate || undefined,
      calendarType: formState.calendarType,
      calendarTimezone: formState.calendarTimezone,
      calendarMethod: formState.calendarMethod,
    });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    const confirmed = window.confirm(
      locale === 'fr'
        ? 'Supprimer ce dossier et son calendrier associé ?'
        : 'Delete this matter and associated calendar?',
    );
    if (!confirmed) return;
    deleteMutation.mutate(selectedId);
  };

  const nextDeadlineLabel = (matter: MatterSummary) => {
    if (!matter.nextDeadline) return '—';
    try {
      const formatted = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(matter.nextDeadline.dueAt),
      );
      return `${formatted}`;
    } catch (_error) {
      return matter.nextDeadline.dueAt;
    }
  };

  const formatDateValue = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
    } catch (_error) {
      return value;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="glass-card rounded-3xl border border-slate-800/60 p-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-slate-400" htmlFor="matter-search">
              {messages.research.filters}
            </label>
            <Button
              variant="outline"
              size="icon"
              onClick={openCreateSheet}
              aria-label={messages.matters.new}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Input
            id="matter-search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={locale === 'fr' ? 'Rechercher un dossier…' : 'Search a matter…'}
            className="mt-3"
          />
        </div>
        <div className="space-y-3">
          {matters.map((matter) => (
            <button
              key={matter.id}
              type="button"
              onClick={() => setSelectedId(matter.id)}
              className={`focus-ring w-full rounded-3xl border px-4 py-3 text-left transition ${
                matter.id === selectedId
                  ? 'border-teal-400/80 bg-teal-400/10 text-teal-100'
                  : 'border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-teal-400/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{matter.title}</p>
                {statusChip(matter.status)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{matter.jurisdiction ?? '—'}</span>
                {matter.nextDeadline ? (
                  <span className="flex items-center gap-1 text-teal-200">
                    <CalendarPlus className="h-3 w-3" aria-hidden />
                    {nextDeadlineLabel(matter)}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {riskBadge(matter.riskLevel)}
                {matter.hitlRequired ? (
                  <Badge variant="outline" className="border-amber-300/60 text-amber-200">
                    {messages.workspace.requiresHitl}
                  </Badge>
                ) : null}
                {matter.citeCheck.total > 0 ? (
                  <Badge variant="outline" className="gap-1 text-xs text-slate-200">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    {`${matter.citeCheck.verified}/${matter.citeCheck.total}`}
                  </Badge>
                ) : null}
              </div>
            </button>
          ))}
          {matters.length === 0 && !mattersQuery.isLoading ? (
            <p className="text-sm text-slate-500">{messages.matters.empty}</p>
          ) : null}
          {mattersQuery.isLoading ? (
            <p className="text-xs text-slate-500">{locale === 'fr' ? 'Chargement…' : 'Loading…'}</p>
          ) : null}
        </div>
      </aside>
      <section className="space-y-6">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-slate-100">
              {detail ? detail.matter.title : messages.matters.overview}
              <div className="flex items-center gap-2">
                {detail ? statusChip(detail.matter.status) : null}
                {detail ? riskBadge(detail.matter.riskLevel) : null}
              </div>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEditSheet} disabled={!detail}>
                <Edit2 className="mr-2 h-4 w-4" aria-hidden />
                {messages.matters.edit}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!detail || calendarMutation.isPending}
                onClick={() => detail?.matter.id && calendarMutation.mutate(detail.matter.id)}
              >
                {calendarMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                )}
                {messages.matters.ics}
              </Button>
              <Button variant="ghost" size="sm" disabled={!detail || deleteMutation.isPending} onClick={handleDelete}>
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                )}
                {messages.matters.delete}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {detail ? (
              <>
                <p className="leading-relaxed">{detail.matter.description || messages.matters.overview}</p>
                <Separator className="bg-slate-800/60" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoField label={messages.matters.governingLaw} value={detail.matter.jurisdiction ?? '—'} />
                  <InfoField label={messages.matters.procedure} value={detail.matter.procedure ?? '—'} />
                  <InfoField
                    label={messages.matters.timeline}
                    value={formatDateValue(detail.matter.filingDate)}
                  />
                  <InfoField label="Decision" value={formatDateValue(detail.matter.decisionDate)} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>
                    {messages.matters.citeCheck}: {detail.citeCheck.verified}/{detail.citeCheck.total}
                  </span>
                  {detail.citeCheck.manual > 0 ? (
                    <span className="flex items-center gap-1 text-amber-300">
                      <ShieldAlert className="h-3 w-3" aria-hidden /> {detail.citeCheck.manual}
                    </span>
                  ) : null}
                  {detail.citeCheck.pending > 0 ? (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Loader2 className="h-3 w-3" aria-hidden /> {detail.citeCheck.pending}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{messages.matters.empty}</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.matters.timeline}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {detail && detail.deadlines.length > 0 ? (
              detail.deadlines.map((deadline) => (
                <div key={deadline.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{deadline.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {formatDateValue(deadline.dueAt)}
                    </Badge>
                  </div>
                  {deadline.ruleReference ? (
                    <p className="mt-1 text-xs text-slate-300">{deadline.ruleReference}</p>
                  ) : null}
                  {deadline.notes ? (
                    <p className="mt-2 text-xs text-slate-400">{deadline.notes}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{messages.matters.deadlineNotes}</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.matters.deadlineWizard}</CardTitle>
            <p className="text-xs text-slate-400">{messages.matters.deadlineNotes}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Input
                  value={formState.procedure}
                  onChange={(event) => setFormState((prev) => ({ ...prev, procedure: event.target.value }))}
                  placeholder={messages.matters.procedure}
                />
                <Input
                  value={formState.jurisdiction}
                  onChange={(event) => setFormState((prev) => ({ ...prev, jurisdiction: event.target.value }))}
                  placeholder={messages.matters.governingLaw}
                />
                <Input
                  value={formState.filingDate}
                  type="date"
                  onChange={(event) => setFormState((prev) => ({ ...prev, filingDate: event.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/40 px-3 py-2">
                    <span>Court days</span>
                    <Switch
                      checked={formState.calendarType === 'court'}
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          calendarType: prev.calendarType === 'court' ? 'calendar' : 'court',
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/40 px-3 py-2">
                    <span>Expedited</span>
                    <Switch
                      checked={formState.calendarMethod === 'expedited'}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({
                          ...prev,
                          calendarMethod: checked ? 'expedited' : prev.calendarMethod === 'expedited' ? 'standard' : prev.calendarMethod,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/40 px-3 py-2">
                    <span>Extended</span>
                    <Switch
                      checked={formState.calendarMethod === 'extended'}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({
                          ...prev,
                          calendarMethod: checked ? 'extended' : prev.calendarMethod === 'extended' ? 'standard' : prev.calendarMethod,
                        }))
                      }
                    />
                  </label>
                  <Input
                    value={formState.calendarTimezone}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, calendarTimezone: event.target.value }))
                    }
                    placeholder="Europe/Paris"
                    className="col-span-2"
                  />
                </div>
                <Button onClick={handlePreview} disabled={previewMutation.isPending}>
                  {previewMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {messages.matters.compute}
                </Button>
              </div>
              <div className="space-y-3">
                {deadlinePreview.length === 0 ? (
                  <p className="text-sm text-slate-400">{messages.matters.deadlineNotes}</p>
                ) : (
                  <ul className="space-y-3 text-sm text-slate-200">
                    {deadlinePreview.map((item) => (
                      <li key={`${item.name}-${item.dueAt}`} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-slate-300">{item.ruleReference}</p>
                        <p className="text-xs text-slate-400">{new Date(item.dueAt).toLocaleString(locale)}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.notes}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {previewNotes ? (
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs text-slate-300">
                    <p>{previewNotes.method}</p>
                    <p className="mt-2">{previewNotes.calendar}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.matters.documents}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {detail && detail.documents.length > 0 ? (
              detail.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{document.name ?? document.documentId ?? messages.matters.documentFallback}</p>
                    {document.citeCheckStatus ? (
                      <Badge variant="outline" className="uppercase">
                        {document.citeCheckStatus}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">
                    {document.role ? `${document.role} • ` : ''}
                    {document.residencyZone ?? '—'}
                  </p>
                  {document.storagePath ? (
                    <a
                      className="focus-ring inline-flex items-center gap-2 text-xs text-teal-200"
                      href={`https://app.supabase.com/storage/v1/object/${document.storagePath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {messages.citationsBrowser.open}
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{messages.matters.citeCheck}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <MatterSheet
        open={isSheetOpen}
        mode={sheetMode}
        detail={detail}
        formState={formState}
        setFormState={setFormState}
        onOpenChange={setIsSheetOpen}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
        messages={messages}
      />
    </div>
  );
}

function createObjectUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  );
}

interface MatterSheetProps {
  open: boolean;
  mode: 'create' | 'edit';
  detail: MatterDetailResponse | null;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  isSaving: boolean;
  messages: Messages;
}

function MatterSheet({
  open,
  mode,
  detail,
  formState,
  setFormState,
  onOpenChange,
  onSubmit,
  isSaving,
  messages,
}: MatterSheetProps) {
  const title = mode === 'create' ? messages.matters.new : detail?.matter.title ?? '';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        } else {
          onOpenChange(true);
        }
      }}
      title={title}
      description={messages.matters.deadlineNotes}
    >
      <SheetSection className="space-y-4">
        <Input
          value={formState.title}
          onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={messages.matters.titleLabel}
        />
        <Textarea
          value={formState.description}
          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={messages.matters.descriptionLabel}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={formState.jurisdiction}
            onChange={(event) => setFormState((prev) => ({ ...prev, jurisdiction: event.target.value }))}
            placeholder={messages.matters.governingLaw}
          />
          <Input
            value={formState.procedure}
            onChange={(event) => setFormState((prev) => ({ ...prev, procedure: event.target.value }))}
            placeholder={messages.matters.procedure}
          />
          <Input
            value={formState.status}
            onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
            placeholder={messages.matters.statusLabel}
          />
          <Input
            value={formState.riskLevel}
            onChange={(event) => setFormState((prev) => ({ ...prev, riskLevel: event.target.value }))}
            placeholder={messages.matters.riskLabel}
          />
          <label className="flex items-center gap-3 text-xs text-slate-300">
            <Switch
              checked={formState.hitlRequired}
              onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, hitlRequired: checked }))}
            />
            {messages.workspace.requiresHitl}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="date"
            value={formState.filingDate}
            onChange={(event) => setFormState((prev) => ({ ...prev, filingDate: event.target.value }))}
          />
          <Input
            type="date"
            value={formState.decisionDate}
            onChange={(event) => setFormState((prev) => ({ ...prev, decisionDate: event.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={formState.calendarTimezone}
            onChange={(event) => setFormState((prev) => ({ ...prev, calendarTimezone: event.target.value }))}
            placeholder="Europe/Paris"
          />
          <Input
            value={formState.calendarMethod}
            onChange={(event) => setFormState((prev) => ({ ...prev, calendarMethod: event.target.value as FormState['calendarMethod'] }))}
            placeholder="standard"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <Switch
            checked={formState.calendarType === 'court'}
            onCheckedChange={(checked) =>
              setFormState((prev) => ({ ...prev, calendarType: checked ? 'court' : 'calendar' }))
            }
          />
          <span>
            {formState.calendarType === 'court' ? messages.matters.courtDays : messages.matters.calendarDays}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <XCircle className="mr-2 h-4 w-4" aria-hidden />
            {messages.matters.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={isSaving || !formState.title.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === 'create'
              ? messages.matters.create
              : messages.matters.save}
          </Button>
        </div>
      </SheetSection>
    </Sheet>
  );
}
