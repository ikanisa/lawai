import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitResearchQuestion, DEMO_ORG_ID, DEMO_USER_ID } from '../lib/api';
import { useOnlineStatus } from './use-online-status';

export interface OutboxItem {
  id: string;
  question: string;
  context?: string;
  confidentialMode: boolean;
  createdAt: string;
  resumedAt?: string;
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
    return parsed.filter((item): item is OutboxItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as OutboxItem).id === 'string' &&
      typeof (item as OutboxItem).question === 'string',
    );
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

  const flush = useCallback(async () => {
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
        await submitResearchQuestion({
          question: item.question,
          context: item.context,
          orgId: DEMO_ORG_ID,
          userId: DEMO_USER_ID,
          confidentialMode: item.confidentialMode,
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
