export type AnalyticsEvent<TPayload = Record<string, unknown>> = {
  name: string;
  payload?: TPayload;
};

export function trackEvent<TPayload = Record<string, unknown>>(
  _event: AnalyticsEvent<TPayload>
) {
  // Placeholder analytics implementation for non-Vercel deployments.
}
