import type { NextWebVitalsMetric } from "next/app";

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NextWebVitalsMetric>("avocat:web-vital", { detail: metric }));
}
