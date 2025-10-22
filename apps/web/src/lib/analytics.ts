/**
 * Client-side analytics placeholder used outside Vercel.
 * Integrate with your preferred telemetry provider here.
 */
export type AnalyticsEvent<TPayload = Record<string, unknown>> = {
  name: string;
  payload?: TPayload;
};

export function trackEvent<TPayload = Record<string, unknown>>(
  _event: AnalyticsEvent<TPayload>
): void {
  // No-op analytics implementation. Replace with custom logic when integrating.
}
