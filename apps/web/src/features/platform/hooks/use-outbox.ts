import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOnlineStatus } from './use-online-status';

export interface OutboxItem {
  id: string;
  question: string;
  context?: string;
  confidentialMode: boolean;
  createdAt: string;
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

interface UseOutboxOptions {
  persist?: boolean;
}

export function useOutbox(options: UseOutboxOptions = {}) {
  const persist = options.persist ?? true;
  const [shouldPersist, setShouldPersist] = useState(persist);
  const [items, setItems] = useState<OutboxItem[]>(() => (persist ? loadInitial() : []));
  const online = useOnlineStatus();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (persist === shouldPersist) {
      return;
    }

    setShouldPersist(persist);

    if (persist) {
      setItems(loadInitial());
    } else {
      setItems([]);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [persist, shouldPersist]);

  useEffect(() => {
    if (!shouldPersist || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, shouldPersist]);

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

  const flush = useCallback(
    async (handler: (item: OutboxItem) => Promise<boolean> | boolean) => {
      const snapshot = items
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const completed = new Set<string>();

      for (const item of snapshot) {
        try {
          const result = await handler(item);
          if (result) {
            completed.add(item.id);
          }
        } catch (error) {
          console.warn('outbox_flush_failed', error);
        }
      }

      if (completed.size > 0) {
        setItems((current) => current.filter((item) => !completed.has(item.id)));
      }
    },
    [items],
  );

  const sorted = useMemo(() => items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [items]);

  useEffect(() => {
    if (sorted.length === 0) {
      return;
    }
    const interval: ReturnType<typeof setInterval> = setInterval(
      () => forceUpdate((value) => value + 1),
      30_000,
    );
    return () => clearInterval(interval);
  }, [sorted.length]);

  const newest = sorted[0];

  return {
    items: sorted,
    enqueue,
    remove,
    clear,
    flush,
    pendingCount: sorted.length,
    hasItems: sorted.length > 0,
    get stalenessMs() {
      return newest ? Math.max(0, Date.now() - new Date(newest.createdAt).getTime()) : 0;
    },
    isOnline: online,
  };
}
