"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useTelemetry } from "@/lib/telemetry";

export type OutboxStatus = "queued" | "syncing" | "failed";
export type OutboxChannel = "voice" | "research" | "upload";

export interface OutboxItem<TPayload = unknown> {
  id: string;
  channel: OutboxChannel;
  payload: TPayload;
  queuedAt: string;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
}

interface OutboxContextValue {
  items: OutboxItem[];
  isOnline: boolean;
  offlineSince?: string;
  stalenessMs: number;
  enqueue: <TPayload>(
    item: Omit<OutboxItem<TPayload>, "id" | "queuedAt" | "status" | "attempts"> & { status?: OutboxStatus }
  ) => OutboxItem<TPayload>;
  markSyncing: (id: string) => void;
  markFailed: (id: string, error?: string) => void;
  markComplete: (id: string) => void;
  flush: (handler: (item: OutboxItem) => Promise<boolean>) => Promise<void>;
}

const OutboxContext = createContext<OutboxContextValue | null>(null);

const STORAGE_KEY = "avocat-ai-pwa-outbox";

function loadInitialOutbox(): OutboxItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as OutboxItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => ({
      ...item,
      queuedAt: item.queuedAt ?? new Date().toISOString(),
      status: item.status ?? "queued",
      attempts: item.attempts ?? 0,
    }));
  } catch (_error) {
    return [];
  }
}

function persistOutbox(items: OutboxItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `outbox_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function OutboxProvider({ children }: { children: ReactNode }) {
  const telemetry = useTelemetry();
  const [items, setItems] = useState<OutboxItem[]>(() => loadInitialOutbox());
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const offlineSinceRef = useRef<string | undefined>(
    typeof navigator !== "undefined" && !navigator.onLine ? new Date().toISOString() : undefined
  );

  useEffect(() => {
    persistOutbox(items);
  }, [items]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      offlineSinceRef.current = undefined;
    }
    function handleOffline() {
      setIsOnline(false);
      if (!offlineSinceRef.current) {
        offlineSinceRef.current = new Date().toISOString();
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const enqueue = useCallback<OutboxContextValue["enqueue"]>(
    (item) => {
      const entry: OutboxItem = {
        id: createId(),
        queuedAt: new Date().toISOString(),
        status: item.status ?? "queued",
        attempts: 0,
        ...item,
      };
      setItems((prev) => [...prev, entry]);
      if (!isOnline) {
        telemetry.emit("offline_retry", { entity: entry.id, attempt: 0 });
      }
      return entry;
    },
    [isOnline, telemetry]
  );

  const updateItem = useCallback((id: string, updater: (item: OutboxItem) => OutboxItem) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? updater(item) : item));
      return next;
    });
  }, []);

  const markSyncing = useCallback<OutboxContextValue["markSyncing"]>((id) => {
    updateItem(id, (item) => ({
      ...item,
      status: "syncing",
      attempts: item.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    }));
  }, [updateItem]);

  const markFailed = useCallback<OutboxContextValue["markFailed"]>((id, error) => {
    updateItem(id, (item) => ({ ...item, status: "failed", error }));
  }, [updateItem]);

  const markComplete = useCallback<OutboxContextValue["markComplete"]>((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const flush = useCallback<OutboxContextValue["flush"]>(
    async (handler) => {
      for (const item of items) {
        markSyncing(item.id);
        try {
          const success = await handler({ ...item, status: "syncing" });
          if (success) {
            markComplete(item.id);
          } else {
            markFailed(item.id);
            telemetry.emit("offline_retry", { entity: item.id, attempt: item.attempts + 1 });
          }
        } catch (error) {
          markFailed(item.id, error instanceof Error ? error.message : String(error));
          telemetry.emit("offline_retry", { entity: item.id, attempt: item.attempts + 1 });
        }
      }
    },
    [items, markComplete, markFailed, markSyncing, telemetry]
  );

  const stalenessMs = useMemo(() => {
    if (!items.length) {
      return 0;
    }
    const oldest = items.reduce((acc, item) => {
      return acc && new Date(acc).getTime() < new Date(item.queuedAt).getTime() ? acc : item.queuedAt;
    }, items[0].queuedAt);
    return Date.now() - new Date(oldest).getTime();
  }, [items]);

  const contextValue = useMemo<OutboxContextValue>(
    () => ({
      items,
      isOnline,
      offlineSince: offlineSinceRef.current,
      stalenessMs,
      enqueue,
      markSyncing,
      markFailed,
      markComplete,
      flush,
    }),
    [enqueue, flush, isOnline, items, markComplete, markFailed, markSyncing, stalenessMs]
  );

  return <OutboxContext.Provider value={contextValue}>{children}</OutboxContext.Provider>;
}

export function useOutboxContext() {
  const context = useContext(OutboxContext);
  if (!context) {
    throw new Error("useOutboxContext must be used within an OutboxProvider");
  }
  return context;
}

export function useOutbox() {
  return useOutboxContext();
}
