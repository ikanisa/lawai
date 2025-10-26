'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  MessageSquare,
  RefreshCw,
  Signal,
  XCircle,
} from 'lucide-react';

import {
  cancelChatkitSession,
  createChatkitSession,
  fetchChatkitSession,
  postChatkitEvent,
  type ChatkitSessionRecord,
} from '@/lib/api';
import { ChatkitClient, type ChatkitConnection, type ChatkitTransport } from '@/lib/chatkit-client';
import { cn } from '@/lib/utils';
import type { Locale, Messages } from '@/lib/i18n';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Separator } from '@/ui/separator';

import { chatkitKeys, chatkitQueries } from '../api/queries';
import { useRequiredSession } from '@/components/session-provider';
import { useSessionTelemetry } from '@/hooks/use-session-telemetry';

interface ChatkitSessionPanelProps {
  messages: Messages;
  locale: Locale;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'connected-webrtc' | 'error';

type ChatkitTaskStatus = 'pending' | 'running' | 'completed' | 'blocked';

interface ChatkitTask {
  id: string;
  title: string;
  status: ChatkitTaskStatus;
  description?: string;
  requiresHitl?: boolean;
}

function buildDefaultTaskMetadata(messages: Messages) {
  const copy = messages.workspace.chatkit.defaultTasks;
  return [
    {
      id: 'intake',
      title: copy.intakeTitle,
      status: 'running',
      description: copy.intakeDescription,
      requiresHitl: false,
    },
    {
      id: 'analysis',
      title: copy.analysisTitle,
      status: 'pending',
      description: copy.analysisDescription,
      requiresHitl: false,
    },
    {
      id: 'review',
      title: copy.reviewTitle,
      status: 'pending',
      description: copy.reviewDescription,
      requiresHitl: true,
    },
  ];
}

function formatRelative(value: string | null, locale: Locale): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (absMs < 60_000) {
    return rtf.format(Math.round(diffMs / 1_000), 'second');
  }
  if (absMs < 3_600_000) {
    return rtf.format(Math.round(diffMs / 60_000), 'minute');
  }
  if (absMs < 86_400_000) {
    return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  }
  return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

function normaliseTasks(session: ChatkitSessionRecord | null, messages: Messages): ChatkitTask[] {
  if (!session) {
    return [];
  }

  const rawTasks = session.metadata?.['tasks'] as unknown;
  if (Array.isArray(rawTasks)) {
    return rawTasks
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const statusValue = typeof record.status === 'string' ? (record.status as ChatkitTaskStatus) : 'pending';
        const status: ChatkitTaskStatus = ['pending', 'running', 'completed', 'blocked'].includes(statusValue)
          ? statusValue
          : 'pending';
        return {
          id: typeof record.id === 'string' ? record.id : `${session.id}-task-${index + 1}`,
          title: typeof record.title === 'string'
            ? record.title
            : `${messages.workspace.chatkit.defaultTasks.genericTitle} ${index + 1}`,
          status,
          description: typeof record.description === 'string' ? record.description : undefined,
          requiresHitl: Boolean(record.requiresHitl ?? record.requires_hitl),
        } satisfies ChatkitTask;
      })
      .filter((task): task is ChatkitTask => Boolean(task));
  }

  const copy = messages.workspace.chatkit.defaultTasks;
  return [
    {
      id: `${session.id}-intake`,
      title: copy.intakeTitle,
      status: session.status === 'active' ? 'running' : 'completed',
      description: copy.intakeDescription,
      requiresHitl: false,
    },
    {
      id: `${session.id}-analysis`,
      title: copy.analysisTitle,
      status: session.status === 'active' ? 'pending' : 'completed',
      description: copy.analysisDescription,
      requiresHitl: false,
    },
    {
      id: `${session.id}-review`,
      title: copy.reviewTitle,
      status: 'pending',
      description: copy.reviewDescription,
      requiresHitl: true,
    },
  ];
}

function sessionStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'outline' {
  if (status === 'active') return 'success';
  if (status === 'ended') return 'outline';
  return 'default';
}

function taskStatusVariant(status: ChatkitTaskStatus): 'default' | 'success' | 'warning' | 'danger' | 'outline' {
  switch (status) {
    case 'running':
      return 'warning';
    case 'completed':
      return 'success';
    case 'blocked':
      return 'danger';
    default:
      return 'outline';
  }
}

function connectionBadgeVariant(state: ConnectionState): 'default' | 'success' | 'warning' | 'danger' | 'outline' {
  if (state === 'connected' || state === 'connected-webrtc') {
    return 'success';
  }
  if (state === 'connecting') {
    return 'warning';
  }
  if (state === 'error') {
    return 'danger';
  }
  return 'outline';
}

export function ChatkitSessionPanel({ messages, locale }: ChatkitSessionPanelProps) {
  const copy = messages.workspace.chatkit;
  const queryClient = useQueryClient();
  const { orgId } = useRequiredSession();
  const sendTelemetry = useSessionTelemetry();
  const chatkitClient = useMemo(() => new ChatkitClient(), []);
  const sessionCache = useRef<Map<string, ChatkitSessionRecord>>(new Map());
  const connectionRef = useRef<ChatkitConnection | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastEventPayload, setLastEventPayload] = useState<string | null>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string | null>(null);

  const sessionsQuery = useQuery(chatkitQueries.sessions(orgId, 'active'));
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  useEffect(() => {
    for (const session of sessions) {
      const cached = sessionCache.current.get(session.id);
      sessionCache.current.set(
        session.id,
        cached ? { ...cached, ...session, chatkit: cached.chatkit ?? session.chatkit } : session,
      );
    }
  }, [sessions]);

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) {
      return null;
    }
    return sessionCache.current.get(selectedSessionId) ?? sessions.find((session) => session.id === selectedSessionId) ?? null;
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!selectedSession) {
      setConnectionState('idle');
      setLastEventPayload(null);
      connectionRef.current?.close();
      connectionRef.current = null;
      return;
    }

    let active = true;

    const connect = async () => {
      setConnectionState('connecting');
      let hydrated = selectedSession;
      if (!selectedSession.chatkit?.clientSecret) {
        try {
          const fetched = await fetchChatkitSession(selectedSession.id, { includeSecret: true });
          if (!active) {
            return;
          }
          sessionCache.current.set(fetched.id, fetched);
          hydrated = fetched;
        } catch (error) {
          console.error('chatkit_session_secret_fetch_failed', error);
        }
      }

      const transportValue = hydrated.metadata?.['transport'];
      const transport: ChatkitTransport = transportValue === 'webrtc' || transportValue === 'sse'
        ? (transportValue as ChatkitTransport)
        : 'sse';

      try {
        const connection = await chatkitClient.connect({
          session: hydrated,
          transport,
          requireSecret: transport === 'webrtc',
          onEvent: (event) => {
            if (!active) {
              return;
            }
            const payload = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            setLastEventPayload(payload);
            setLastEventTimestamp(new Date().toISOString());
            console.info('chatkit_event_received', {
              sessionId: hydrated.id,
              transport,
              eventType: event.type,
            });
            sendTelemetry('chatkit_event_received', {
              sessionId: hydrated.id,
              transport,
              eventType: event.type,
            });
          },
          onError: (event) => {
            if (!active) {
              return;
            }
            setConnectionState('error');
            console.error('chatkit_stream_error', {
              sessionId: hydrated.id,
              transport,
              eventType: event.type,
            });
            sendTelemetry('chatkit_stream_error', {
              sessionId: hydrated.id,
              transport,
              eventType: event.type,
            });
          },
        });

        if (!active) {
          connection.close();
          return;
        }

        connectionRef.current?.close();
        connectionRef.current = connection;
        setConnectionState(transport === 'webrtc' ? 'connected-webrtc' : 'connected');
        console.info('chatkit_stream_connected', { sessionId: hydrated.id, transport });
        sendTelemetry('chatkit_stream_connected', {
          sessionId: hydrated.id,
          transport,
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setConnectionState('error');
        console.error('chatkit_stream_failed', error);
        sendTelemetry('chatkit_stream_failed', {
          sessionId: hydrated.id,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    };

    void connect();

    return () => {
      active = false;
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, [chatkitClient, selectedSession, sendTelemetry]);

  const tasks = useMemo(() => normaliseTasks(selectedSession, messages), [selectedSession, messages]);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const metadataTasks = buildDefaultTaskMetadata(messages);
      const session = await createChatkitSession({
        orgId,
        metadata: {
          transport: 'sse',
          tasks: metadataTasks,
        },
      });
      sessionCache.current.set(session.id, session);
      return session;
    },
    onSuccess: (session) => {
      setSelectedSessionId(session.id);
      setConnectionState('connecting');
      void queryClient.invalidateQueries({ queryKey: chatkitKeys.sessions(orgId) });
      console.info('chatkit_session_started', { sessionId: session.id, agent: session.agentName });
      sendTelemetry('chatkit_session_started', {
        sessionId: session.id,
        agent: session.agentName,
        channel: session.channel,
      });
    },
    onError: (error) => {
      console.error('chatkit_session_start_failed', error);
      sendTelemetry('chatkit_session_start_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async (session: ChatkitSessionRecord) => cancelChatkitSession(session.id),
    onSuccess: (updated, original) => {
      sessionCache.current.set(updated.id, updated);
      void queryClient.invalidateQueries({ queryKey: chatkitKeys.sessions(orgId) });
      if (selectedSessionId === updated.id) {
        setSelectedSessionId(null);
      }
      console.info('chatkit_session_cancelled', { sessionId: updated.id });
      sendTelemetry('chatkit_session_cancelled', {
        sessionId: updated.id,
        previousStatus: original.status,
      });
    },
    onError: (error, session) => {
      console.error('chatkit_session_cancel_failed', error);
      sendTelemetry('chatkit_session_cancel_failed', {
        sessionId: session.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async (session: ChatkitSessionRecord) => {
      await postChatkitEvent(session.id, {
        type: 'hitl.escalation.requested',
        payload: {
          agent: session.agentName,
          tasks: normaliseTasks(session, messages).map((task) => ({ id: task.id, status: task.status })),
        },
      });
    },
    onSuccess: (_result, session) => {
      console.info('chatkit_hitl_escalated', { sessionId: session.id });
      sendTelemetry('chatkit_hitl_escalated', {
        sessionId: session.id,
        agent: session.agentName,
      });
      void queryClient.invalidateQueries({ queryKey: chatkitKeys.sessions(orgId) });
    },
    onError: (error, session) => {
      console.error('chatkit_hitl_escalation_failed', error);
      sendTelemetry('chatkit_hitl_escalation_failed', {
        sessionId: session.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    },
  });

  const handleStartSession = useCallback(() => {
    startSessionMutation.mutate();
  }, [startSessionMutation]);

  const handleCancelSession = useCallback(() => {
    if (selectedSession) {
      cancelSessionMutation.mutate(selectedSession);
    }
  }, [cancelSessionMutation, selectedSession]);

  const handleEscalate = useCallback(() => {
    if (selectedSession) {
      escalateMutation.mutate(selectedSession);
    }
  }, [escalateMutation, selectedSession]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatkitKeys.sessions(orgId) });
  }, [orgId, queryClient]);

  const connectionLabelMap: Record<ConnectionState, string> = {
    idle: copy.connection.idle,
    connecting: copy.connection.connecting,
    connected: copy.connection.connected,
    'connected-webrtc': copy.connection.connectedWebrtc,
    error: copy.connection.error,
  };

  const connectionBadge = connectionBadgeVariant(connectionState);

  return (
    <Card className="border-slate-800/60 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <MessageSquare className="h-5 w-5 text-emerald-300" aria-hidden />
          {copy.title}
        </CardTitle>
        <CardDescription className="text-sm text-slate-300">{copy.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={connectionBadge} className="uppercase tracking-wide">
              {connectionLabelMap[connectionState]}
            </Badge>
            {selectedSession ? (
              <Badge variant="outline" className="uppercase tracking-wide text-xs text-slate-300">
                {copy.sessionLabel.replace('{id}', selectedSession.id.slice(0, 8))}
              </Badge>
            ) : null}
            {lastEventTimestamp ? (
              <span className="text-xs text-slate-400">
                {copy.lastEventLabel}: {formatRelative(lastEventTimestamp, locale)}
              </span>
            ) : (
              <span className="text-xs text-slate-500">{copy.eventIdle}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="border border-slate-800/60 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
              onClick={handleRefresh}
              disabled={sessionsQuery.isLoading || sessionsQuery.isRefetching}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', sessionsQuery.isRefetching ? 'animate-spin' : '')} aria-hidden />
              {copy.refresh}
            </Button>
            {selectedSession ? (
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-200 hover:bg-red-500/10"
                onClick={handleCancelSession}
                disabled={cancelSessionMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" aria-hidden />
                {copy.cancel}
              </Button>
            ) : null}
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
              onClick={handleStartSession}
              disabled={startSessionMutation.isPending}
            >
              {copy.startSession}
            </Button>
          </div>
        </div>

        <Separator className="border-slate-800/80" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.activeSessions}</h3>
            {sessionsQuery.isError ? (
              <p className="rounded-2xl border border-dashed border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                {copy.loadError}
              </p>
            ) : sessionsQuery.isLoading ? (
              <p className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-400">
                {copy.loading}
              </p>
            ) : sessions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-400">
                {copy.emptyStateDetail}
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isSelected = session.id === selectedSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                        'bg-slate-900/40 text-sm text-slate-200 hover:bg-slate-900/70',
                        isSelected ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10' : 'border-slate-800/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Badge variant={sessionStatusVariant(session.status)}>{copy.status[session.status] ?? session.status}</Badge>
                            <span>{copy.startedAt.replace('{time}', formatRelative(session.createdAt, locale))}</span>
                          </div>
                          <div className="text-sm font-semibold text-slate-100">{session.agentName}</div>
                        </div>
                        <Signal className={cn('h-4 w-4', isSelected ? 'text-emerald-300' : 'text-slate-500')} aria-hidden />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {selectedSession ? (
              <>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{copy.metricsLabel}</p>
                      <p className="text-xs text-slate-400">
                        {copy.transportLabel}: {(selectedSession.metadata?.['transport'] as string) ?? 'sse'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {copy.lastEventLabel}:{' '}
                      {lastEventTimestamp ? formatRelative(lastEventTimestamp, locale) : copy.eventIdle}
                    </div>
                  </div>
                  {lastEventPayload ? (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-950/80 p-3 text-xs text-slate-300/90">
                      {lastEventPayload}
                    </pre>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {copy.tasksTitle}
                    </h3>
                    {selectedSession.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto flex items-center gap-2 text-xs text-amber-200 hover:bg-amber-500/10"
                        onClick={handleEscalate}
                        disabled={escalateMutation.isPending}
                      >
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                        {copy.escalate}
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{task.title}</p>
                            {task.description ? (
                              <p className="text-xs text-slate-400">{task.description}</p>
                            ) : null}
                          </div>
                          <Badge variant={taskStatusVariant(task.status)}>
                            {copy.status[task.status] ?? task.status}
                          </Badge>
                        </div>
                        {task.requiresHitl && selectedSession.status === 'active' ? (
                          <p className="mt-2 text-xs text-amber-300">{copy.escalateDescription}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400">
                {copy.emptyStateDetail}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
