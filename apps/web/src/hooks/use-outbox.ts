import { useCallback, useEffect, useMemo, useState } from 'react';

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

export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>(() => loadInitial());

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

  return { items: sorted, enqueue, remove, clear, flush };
}
