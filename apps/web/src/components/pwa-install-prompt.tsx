'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, BellRing, History } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import type { Locale, Messages } from '../lib/i18n';
import { usePwaInstall } from '../hooks/use-pwa-install';
import { useDigest } from '../hooks/use-digest';
import { useOutbox } from '../hooks/use-outbox';
import { usePwaPreference } from '../hooks/use-pwa-preference';
import { toast } from 'sonner';
import { sendTelemetryEvent } from '../lib/api';
import { isPwaEnvEnabled, isPwaSupported } from '../lib/pwa';

interface PwaInstallPromptProps {
  messages?: Messages['app']['install'];
  locale: Locale;
}

interface ReleaseNotesCopy {
  title?: string;
  items?: string[];
  digestTitle?: string;
  digestDescription?: string;
  digestCta?: string;
  digestEnabled?: string;
  digestUnavailable?: string;
  releaseToggle?: string;
  releaseToggleHide?: string;
  outboxLabel?: string;
  outboxEmpty?: string;
}

export function PwaInstallPrompt({ messages, locale }: PwaInstallPromptProps) {
  const { shouldPrompt, isAvailable, promptInstall, dismissPrompt } = usePwaInstall();
  const { enabled: digestEnabled, loading: digestLoading, enable: enableDigest } = useDigest();
  const { pendingCount, hasItems, stalenessMs } = useOutbox();
  const { enabled: pwaOptIn, loading: pwaPreferenceLoading, setEnabled: setPwaOptIn } = usePwaPreference();
  const [notesOpen, setNotesOpen] = useState(false);
  const pwaSupported = isPwaSupported();
  const pwaEnvEnabled = isPwaEnvEnabled();

  const releaseNotes = useMemo<ReleaseNotesCopy | null>(() => {
    if (!messages?.releaseNotes) return null;
    const notes = messages.releaseNotes;
    return {
      title: notes.title,
      items: Array.isArray(notes.items) ? notes.items : undefined,
      digestTitle: notes.digestTitle,
      digestDescription: notes.digestDescription,
      digestCta: notes.digestCta,
      digestEnabled: notes.digestEnabled,
      digestUnavailable: notes.digestUnavailable,
      releaseToggle: notes.releaseToggle,
      releaseToggleHide: notes.releaseToggleHide,
      outboxLabel: notes.outboxLabel,
      outboxEmpty: notes.outboxEmpty,
    };
  }, [messages?.releaseNotes]);

  useEffect(() => {
    if (!shouldPrompt) return;
    void sendTelemetryEvent('pwa_prompt_shown', {
      pendingOutbox: pendingCount,
      digestEnabled,
      releaseNotes: releaseNotes?.items?.length ?? 0,
    });
  }, [shouldPrompt, pendingCount, digestEnabled, releaseNotes?.items?.length]);

  if (!messages || !pwaEnvEnabled) {
    return null;
  }

  if (!shouldPrompt && (pwaPreferenceLoading || pwaOptIn)) {
    return null;
  }

  const handleOptInToggle = () => {
    if (pwaPreferenceLoading) {
      return;
    }

    if (!pwaSupported) {
      toast.error(messages.optInUnavailable ?? messages.unavailable);
      return;
    }

    const next = !pwaOptIn;
    setPwaOptIn(next);
    const toastMessage = next ? messages.optInEnabled : messages.optInDisabled;
    if (toastMessage) {
      if (next) {
        toast.success(toastMessage);
      } else {
        toast.info(toastMessage);
      }
    }
  };

  const installReady = shouldPrompt && pwaOptIn && isAvailable;

  const handleInstallNow = async () => {
    if (!installReady) {
      return;
    }

    void sendTelemetryEvent('pwa_install_attempt', { pendingOutbox: pendingCount });
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast.success(messages.success);
      void sendTelemetryEvent('pwa_install_accepted');
    } else if (outcome === 'dismissed') {
      toast.info(messages.snoozed);
      void sendTelemetryEvent('pwa_install_snoozed');
    } else {
      toast.error(messages.unavailable);
      void sendTelemetryEvent('pwa_install_unavailable');
    }
  };

  const handleInstallLater = () => {
    if (!shouldPrompt) {
      return;
    }

    dismissPrompt();
    toast.info(messages.snoozed);
    void sendTelemetryEvent('pwa_install_dismissed');
  };

  const handleDigestOptIn = async () => {
    void sendTelemetryEvent('pwa_digest_opt_in', { pendingOutbox: pendingCount });
    try {
      const granted = await enableDigest();
      if (granted) {
        if (releaseNotes?.digestEnabled) {
          toast.success(releaseNotes.digestEnabled);
        }
        return;
      }
      if (releaseNotes?.digestUnavailable) {
        toast.error(releaseNotes.digestUnavailable);
      }
    } catch (error) {
      toast.error(releaseNotes?.digestUnavailable ?? messages.unavailable);
      console.warn('digest_opt_in_failed', error);
    }
  };

  const outboxMessage = useMemo(() => {
    if (!releaseNotes?.outboxLabel) {
      return null;
    }
    if (!hasItems) {
      return `${releaseNotes.outboxLabel}: ${releaseNotes.outboxEmpty ?? '0'}`;
    }
    return `${releaseNotes.outboxLabel}: ${pendingCount} · ${formatOutboxAge(stalenessMs, locale)}`;
  }, [releaseNotes?.outboxLabel, releaseNotes?.outboxEmpty, hasItems, pendingCount, stalenessMs, locale]);

  return (
    <div className="fixed bottom-28 right-6 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="glass-card border border-slate-800/60 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-grad-1/30 p-2">
            <Download className="h-5 w-5 text-teal-200" aria-hidden />
          </div>
          <div className="flex-1 space-y-4 text-sm text-slate-200">
            <div>
              <p className="text-sm font-semibold text-white">{messages.title}</p>
              <p className="mt-1 text-slate-300">{messages.body}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/50 p-3">
              <Switch
                type="button"
                checked={pwaOptIn}
                disabled={pwaPreferenceLoading || !pwaSupported}
                onClick={handleOptInToggle}
                label={messages.optInToggle}
                className="w-full justify-between"
              />
              {messages.optInDescription ? (
                <p className="mt-2 text-xs text-slate-300">{messages.optInDescription}</p>
              ) : null}
              {!pwaSupported ? (
                <p className="mt-2 text-xs text-amber-200/80">
                  {messages.optInUnavailable ?? messages.unavailable}
                </p>
              ) : null}
            </div>
            {shouldPrompt && releaseNotes ? (
              <div className="rounded-2xl bg-slate-900/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                    {releaseNotes.title}
                  </span>
                  {releaseNotes.items && releaseNotes.items.length > 0 ? (
                    <button
                      className="text-[11px] font-semibold uppercase tracking-wide text-teal-200 hover:text-teal-100"
                      onClick={() => setNotesOpen((prev) => !prev)}
                      type="button"
                    >
                      {notesOpen ? releaseNotes.releaseToggleHide : releaseNotes.releaseToggle}
                    </button>
                  ) : null}
                </div>
                {notesOpen && releaseNotes.items && releaseNotes.items.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                    {releaseNotes.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {shouldPrompt ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleInstallNow} disabled={!installReady}>
                  {messages.cta}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleInstallLater}>
                  {messages.dismiss}
                </Button>
              </div>
            ) : null}
            {shouldPrompt && releaseNotes ? (
              <div className="rounded-2xl bg-slate-900/50 p-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <BellRing className="h-4 w-4 text-teal-200" aria-hidden />
                  <span>{releaseNotes.digestTitle}</span>
                </div>
                {releaseNotes.digestDescription ? (
                  <p className="mt-1 text-slate-300">{releaseNotes.digestDescription}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleDigestOptIn}
                    disabled={digestLoading || digestEnabled}
                  >
                    {digestEnabled
                      ? releaseNotes.digestEnabled ?? messages.success
                      : releaseNotes.digestCta}
                  </Button>
                  {digestEnabled ? (
                    <span className="text-[11px] text-teal-200">✓</span>
                  ) : null}
                </div>
                {outboxMessage ? (
                  <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <History className="h-3.5 w-3.5" aria-hidden />
                    <span className="truncate" title={outboxMessage}>
                      {outboxMessage}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatOutboxAge(stalenessMs: number, locale: Locale): string {
  if (stalenessMs <= 0) {
    return '0 min';
  }
  const minutes = Math.floor(stalenessMs / 60_000);
  if (minutes < 1) {
    return '0 min';
  }
  if (minutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute');
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour');
  }
  const days = Math.floor(hours / 24);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
}
