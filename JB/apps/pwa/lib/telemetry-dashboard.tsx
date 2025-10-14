"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NextWebVitalsMetric } from "next/app";

import { useTelemetry } from "@/lib/telemetry";

interface TelemetryAverages {
  average: number;
  sampleCount: number;
}

export interface TelemetryDashboardMetrics {
  citations: {
    total: number;
    highConfidence: number;
    stale: number;
    accuracy: number;
  };
  temporalValidity: {
    total: number;
    upToDate: number;
    rate: number;
  };
  retrievalRecall: {
    expected: number;
    retrieved: number;
    rate: number;
  };
  hitlLatency: TelemetryAverages;
  voiceLatency: TelemetryAverages;
  webVitals: {
    lcp?: number;
    inp?: number;
    cls?: number;
  };
}

const initialMetrics: TelemetryDashboardMetrics = {
  citations: { total: 0, highConfidence: 0, stale: 0, accuracy: 0 },
  temporalValidity: { total: 0, upToDate: 0, rate: 0 },
  retrievalRecall: { expected: 0, retrieved: 0, rate: 0 },
  hitlLatency: { average: 0, sampleCount: 0 },
  voiceLatency: { average: 0, sampleCount: 0 },
  webVitals: {}
};

const TelemetryDashboardContext = createContext<TelemetryDashboardMetrics>(initialMetrics);

function computeAverage(current: TelemetryAverages, value: number): TelemetryAverages {
  const sampleCount = current.sampleCount + 1;
  const average = current.sampleCount === 0 ? value : (current.average * current.sampleCount + value) / sampleCount;
  return { average, sampleCount };
}

export function TelemetryDashboardProvider({ children }: { children: ReactNode }) {
  const telemetry = useTelemetry();
  const [metrics, setMetrics] = useState<TelemetryDashboardMetrics>(initialMetrics);

  useEffect(() => {
    const unsubscribeCitations = telemetry.on("citations_ready", ({ total, highConfidence, stale }) => {
      setMetrics((prev) => ({
        ...prev,
        citations: {
          total,
          highConfidence,
          stale,
          accuracy: total ? highConfidence / total : 0
        }
      }));
    });

    const unsubscribeTemporal = telemetry.on("temporal_validity_checked", ({ total, upToDate }) => {
      setMetrics((prev) => ({
        ...prev,
        temporalValidity: {
          total,
          upToDate,
          rate: total ? upToDate / total : 0
        }
      }));
    });

    const unsubscribeRecall = telemetry.on("retrieval_recall_scored", ({ expected, retrieved }) => {
      setMetrics((prev) => ({
        ...prev,
        retrievalRecall: {
          expected,
          retrieved,
          rate: expected ? retrieved / expected : 0
        }
      }));
    });

    const unsubscribeHitl = telemetry.on("hitl_latency_measured", ({ latencyMs }) => {
      setMetrics((prev) => ({
        ...prev,
        hitlLatency: computeAverage(prev.hitlLatency, latencyMs)
      }));
    });

    const unsubscribeVoice = telemetry.on("voice_latency_measured", ({ latencyMs }) => {
      setMetrics((prev) => ({
        ...prev,
        voiceLatency: computeAverage(prev.voiceLatency, latencyMs)
      }));
    });

    return () => {
      unsubscribeCitations();
      unsubscribeTemporal();
      unsubscribeRecall();
      unsubscribeHitl();
      unsubscribeVoice();
    };
  }, [telemetry]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const metric = (event as CustomEvent<NextWebVitalsMetric>).detail;
      if (!metric) return;
      setMetrics((prev) => {
        if (metric.name === "LCP") {
          return { ...prev, webVitals: { ...prev.webVitals, lcp: metric.value } };
        }
        if (metric.name === "INP") {
          return { ...prev, webVitals: { ...prev.webVitals, inp: metric.value } };
        }
        if (metric.name === "CLS") {
          return { ...prev, webVitals: { ...prev.webVitals, cls: metric.value } };
        }
        return prev;
      });
    };
    window.addEventListener("avocat:web-vital", handler as EventListener);
    return () => window.removeEventListener("avocat:web-vital", handler as EventListener);
  }, []);

  const value = useMemo(() => metrics, [metrics]);

  return <TelemetryDashboardContext.Provider value={value}>{children}</TelemetryDashboardContext.Provider>;
}

export function useTelemetryMetrics() {
  return useContext(TelemetryDashboardContext);
}
