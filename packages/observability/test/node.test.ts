import { beforeEach, describe, expect, it, vi } from 'vitest';

const nodeSdkStartMock = vi.fn();
const nodeSdkShutdownMock = vi.fn();
const contextDisableMock = vi.fn();
const setGlobalContextManagerMock = vi.fn();
const traceExporterConfigs: Array<Record<string, unknown>> = [];
const metricExporterConfigs: Array<Record<string, unknown>> = [];
const metricReaderConfigs: Array<Record<string, unknown>> = [];

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: class {
    constructor(public readonly options: Record<string, unknown>) {
      nodeSdkTestState.configs.push(options);
    }

    start() {
      return nodeSdkStartMock();
    }

    shutdown() {
      return nodeSdkShutdownMock();
    }
  },
}));

vi.mock('@opentelemetry/context-async-hooks', () => ({
  AsyncHooksContextManager: class {
    enable() {
      nodeSdkTestState.contextEnabled = true;
      return { disable: contextDisableMock };
    }
  },
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {
    constructor(options: Record<string, unknown>) {
      traceExporterConfigs.push(options);
    }
  },
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: class {
    constructor(options: Record<string, unknown>) {
      metricExporterConfigs.push(options);
    }
  },
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: class {
    constructor(options: Record<string, unknown>) {
      metricReaderConfigs.push(options);
    }
  },
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: class {
    constructor(public readonly attributes: Record<string, unknown>) {
      nodeSdkTestState.resources.push(attributes);
    }
  },
}));

vi.mock('@opentelemetry/api', () => ({
  diag: { setLogger: vi.fn() },
  DiagConsoleLogger: class {},
  DiagLogLevel: { ERROR: 0 },
  context: { setGlobalContextManager: setGlobalContextManagerMock },
}));

const nodeSdkTestState = {
  configs: [] as Array<Record<string, unknown>>,
  resources: [] as Array<Record<string, unknown>>,
  contextEnabled: false,
};

describe('initNodeTelemetry', () => {
  beforeEach(async () => {
    nodeSdkStartMock.mockReset().mockResolvedValue(undefined);
    nodeSdkShutdownMock.mockReset().mockResolvedValue(undefined);
    contextDisableMock.mockReset();
    setGlobalContextManagerMock.mockReset();
    traceExporterConfigs.length = 0;
    metricExporterConfigs.length = 0;
    metricReaderConfigs.length = 0;
    nodeSdkTestState.configs.length = 0;
    nodeSdkTestState.resources.length = 0;
    nodeSdkTestState.contextEnabled = false;
    vi.resetModules();
  });

  it('normalises exporter endpoints and sets up SDK', async () => {
    const { initNodeTelemetry } = await import('../src/node.js');

    const runtime = await initNodeTelemetry({
      serviceName: 'avocat-api',
      otlpEndpoint: 'https://collector.internal',
      metricsEndpoint: 'https://collector.internal/custom',
      headers: { Authorization: 'Bearer token' },
      environment: 'production',
      attributes: { 'service.namespace': 'test' },
    });

    expect(traceExporterConfigs[0]).toEqual({ url: 'https://collector.internal/v1/traces', headers: { Authorization: 'Bearer token' } });
    expect(metricExporterConfigs[0]).toEqual({ url: 'https://collector.internal/custom/v1/metrics', headers: { Authorization: 'Bearer token' } });
    expect(metricReaderConfigs[0]).toMatchObject({ exportIntervalMillis: 15_000, exportTimeoutMillis: 10_000 });
    expect(nodeSdkTestState.resources[0]).toMatchObject({
      'service.name': 'avocat-api',
      'service.namespace': 'test',
      'deployment.environment': 'production',
    });
    expect(nodeSdkStartMock).toHaveBeenCalledTimes(1);
    expect(setGlobalContextManagerMock).toHaveBeenCalledTimes(1);

    await runtime.shutdown();
    expect(nodeSdkShutdownMock).toHaveBeenCalledTimes(1);
    expect(contextDisableMock).toHaveBeenCalledTimes(1);
  });

  it('returns cached runtime on subsequent calls', async () => {
    const { initNodeTelemetry } = await import('../src/node.js');

    const first = await initNodeTelemetry({ serviceName: 'api' });
    const second = await initNodeTelemetry({ serviceName: 'api' });

    expect(first).toBe(second);
    expect(nodeSdkStartMock).toHaveBeenCalledTimes(1);

    await first.shutdown();
  });
});
