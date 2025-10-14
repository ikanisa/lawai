import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUTONOMOUS_JUSTICE_SUITE } from '../../../../packages/shared/src/config/autonomous-suite';
import { submitResearchQuestion, DEMO_ORG_ID, DEMO_USER_ID } from '../lib/api';

const SUITE_MANIFEST = AUTONOMOUS_JUSTICE_SUITE;
const AGENT_LABEL_MAP = new Map<string, string>();
for (const [key, definition] of Object.entries(SUITE_MANIFEST.agents)) {
  const externalCode = typeof definition.code === 'string' ? definition.code : key;
  const label = typeof definition.label === 'string' ? definition.label : externalCode;
  if (externalCode) {
    AGENT_LABEL_MAP.set(externalCode, label);
  }
}

const DEFAULT_AGENT_CODE =
  typeof SUITE_MANIFEST.agents.counsel_research?.code === 'string'
    ? SUITE_MANIFEST.agents.counsel_research.code
    : 'conseil_recherche';
const DEFAULT_AGENT_LABEL = AGENT_LABEL_MAP.get(DEFAULT_AGENT_CODE) ?? DEFAULT_AGENT_CODE;
import { useOnlineStatus } from './use-online-status';

export interface OutboxItem {
  id: string;
  question: string;
  context?: string;
  confidentialMode: boolean;
  createdAt: string;
  resumedAt?: string;
  agentCode: string;
  agentLabel: string;
  agentSettings?: Record<string, unknown> | null;
}

const STORAGE_KEY = 'avocat-ai-outbox';

function loadInitial(): OutboxItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .filter((item) => typeof item.question === 'string' && typeof item.id === 'string')
      .map((item) => {
        const agentCode = typeof item.agentCode === 'string' && item.agentCode.trim().length > 0
          ? item.agentCode
          : DEFAULT_AGENT_CODE;
        const agentLabel = typeof item.agentLabel === 'string' && item.agentLabel.trim().length > 0
          ? item.agentLabel
          : AGENT_LABEL_MAP.get(agentCode) ?? DEFAULT_AGENT_LABEL;
        const agentSettings =
          item.agentSettings && typeof item.agentSettings === 'object' && !Array.isArray(item.agentSettings)
            ? (item.agentSettings as Record<string, unknown>)
            : null;

        return {
          id: String(item.id),
          question: String(item.question),
          context: typeof item.context === 'string' ? item.context : undefined,
          confidentialMode: Boolean(item.confidentialMode),
          createdAt:
            typeof item.createdAt === 'string' && item.createdAt.trim().length > 0
              ? item.createdAt
              : new Date().toISOString(),
          resumedAt: typeof item.resumedAt === 'string' ? item.resumedAt : undefined,
          agentCode,
          agentLabel,
          agentSettings,
        } satisfies OutboxItem;
      });
  } catch (error) {
    console.warn('outbox_load_failed', error);
    return [];
  }
}

export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>(() => loadInitial());
  const online = useOnlineStatus();
  const wasOffline = useRef(!online);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistable = items.filter((item) => !item.confidentialMode);
    if (persistable.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    }
  }, [items]);

  const enqueue = useCallback((item: Omit<OutboxItem, 'id' | 'createdAt'>) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `outbox-${Date.now()}`;
    setItems((current) => [
      { ...item, id, createdAt: new Date().toISOString() },
      ...current,
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const flush = useCallback(async (handler?: (item: OutboxItem) => Promise<boolean>) => {
    if (!online) return;
    const snapshot = items
      .slice()
      .filter((item) => !item.confidentialMode)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    if (snapshot.length === 0) {
      return;
    }

    const completed = new Set<string>();
    const failed = new Map<string, OutboxItem>();
    const resumeTime = new Date().toISOString();

    for (const item of snapshot) {
      try {
        if (handler) {
          const handled = await handler(item);
          if (handled) {
            completed.add(item.id);
            continue;
          }
          failed.set(item.id, { ...item, resumedAt: resumeTime });
          continue;
        }
        await submitResearchQuestion({
          question: item.question,
          context: item.context,
          orgId: DEMO_ORG_ID,
          userId: DEMO_USER_ID,
          confidentialMode: item.confidentialMode,
          agentCode: item.agentCode,
          agentSettings: item.agentSettings ?? undefined,
        });
        completed.add(item.id);
      } catch (error) {
        console.warn('outbox_flush_failed', error);
        failed.set(item.id, { ...item, resumedAt: resumeTime });
      }
    }

    if (completed.size > 0 || failed.size > 0) {
      setItems((current) => {
        const remaining = current.filter((item) => !completed.has(item.id));
        if (failed.size === 0) {
          return remaining;
        }
        return remaining.map((item) => failed.get(item.id) ?? item);
      });
    }
  }, [items, online]);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) {
      return;
    }
    wasOffline.current = false;
    flush().catch((error) => console.error('outbox_flush_error', error));
  }, [online, flush]);

  const sorted = useMemo(() => items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [items]);

  return { items: sorted, enqueue, remove, clear, flush };
}
