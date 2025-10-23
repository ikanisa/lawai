interface CounterKey {
  name: string;
  labels: string;
}

const counters = new Map<string, number>();
let meterProviderReady = false;

function makeKey(name: string, labels: Record<string, unknown>): CounterKey {
  const normalisedLabels = Object.entries(labels)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('|');
  return { name, labels: normalisedLabels };
}

export function incrementCounter(name: string, labels: Record<string, unknown> = {}) {
  const key = makeKey(name, labels);
  const mapKey = `${key.name}:${key.labels}`;
  const current = counters.get(mapKey) ?? 0;
  counters.set(mapKey, current + 1);
}

export function getCounterSnapshot() {
  return Array.from(counters.entries()).map(([key, value]) => ({ key, value }));
}

export function resetCounters() {
  counters.clear();
}

export function markMeterProviderReady() {
  meterProviderReady = true;
}

export function isMeterProviderReady() {
  return meterProviderReady;
}

export function resetMeterProviderReady() {
  meterProviderReady = false;
}
