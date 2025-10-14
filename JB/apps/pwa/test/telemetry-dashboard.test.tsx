import { render, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { describe, expect, it } from "vitest";
import { useEffect } from "react";

import { TelemetryProvider, useTelemetry } from "@/lib/telemetry";
import { TelemetryDashboardProvider, useTelemetryMetrics } from "@/lib/telemetry-dashboard";
import type { TelemetryDashboardMetrics } from "@/lib/telemetry-dashboard";

function Harness({
  onReady
}: {
  onReady: (emit: ReturnType<typeof useTelemetry>["emit"], getMetrics: () => TelemetryDashboardMetrics) => void;
}) {
  const telemetry = useTelemetry();
  const metrics = useTelemetryMetrics();

  useEffect(() => {
    onReady(telemetry.emit, () => metrics);
  }, [metrics, onReady, telemetry]);

  return null;
}

describe("TelemetryDashboardProvider", () => {
  it("aggregates telemetry events into dashboard metrics", async () => {
    let emitRef: ReturnType<typeof useTelemetry>["emit"] | null = null;
    let metricsRef: () => TelemetryDashboardMetrics = () => ({
      citations: { total: 0, highConfidence: 0, stale: 0, accuracy: 0 },
      temporalValidity: { total: 0, upToDate: 0, rate: 0 },
      retrievalRecall: { expected: 0, retrieved: 0, rate: 0 },
      hitlLatency: { average: 0, sampleCount: 0 },
      voiceLatency: { average: 0, sampleCount: 0 },
      webVitals: {}
    });

    render(
      <TelemetryProvider>
        <TelemetryDashboardProvider>
          <Harness
            onReady={(emit, getMetrics) => {
              emitRef = emit;
              metricsRef = getMetrics;
            }}
          />
        </TelemetryDashboardProvider>
      </TelemetryProvider>
    );

    await waitFor(() => emitRef !== null);

    act(() => {
      emitRef!("citations_ready", { total: 3, highConfidence: 2, stale: 1 });
      emitRef!("temporal_validity_checked", { total: 3, upToDate: 2 });
      emitRef!("retrieval_recall_scored", { expected: 4, retrieved: 2 });
      emitRef!("hitl_latency_measured", { reviewId: "hitl-1", latencyMs: 1200 });
      emitRef!("voice_latency_measured", { runId: "voice-1", latencyMs: 800 });
    });

    await waitFor(() => metricsRef().citations.total === 3);

    const metrics = metricsRef();
    expect(metrics.citations.accuracy).toBeCloseTo(2 / 3, 2);
    expect(metrics.temporalValidity.rate).toBeCloseTo(2 / 3, 2);
    expect(metrics.retrievalRecall.rate).toBeCloseTo(0.5);
    expect(metrics.hitlLatency.average).toBe(1200);
    expect(metrics.voiceLatency.average).toBe(800);
  });
});
