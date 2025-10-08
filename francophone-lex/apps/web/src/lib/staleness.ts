export interface StalenessOptions {
  thresholdDays?: number;
  offline?: boolean;
  now?: number;
}

const DEFAULT_THRESHOLD_DAYS = 90;

export function isDateStale(value: string | Date | null | undefined, options: StalenessOptions = {}): boolean {
  const { thresholdDays = DEFAULT_THRESHOLD_DAYS, offline = false, now = Date.now() } = options;
  if (offline) return true;
  if (!value) return true;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return date.getTime() < now - thresholdMs;
}

export function daysSince(value: string | Date | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

