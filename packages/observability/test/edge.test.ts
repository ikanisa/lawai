import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const traceExporterConfigs: Array<Record<string, unknown>> = [];
const metricExporterConfigs: Array<Record<string, unknown>> = [];
const metricReaderConfigs: Array<Record<string, unknown>> = [];

const spanEndMock = vi.fn();
const spanRecordExceptionMock = vi.fn();
const spanSetStatusMock = vi.fn();
const tracerStartSpanMock = vi.fn(() => ({
  end: spanEndMock,
  recordException: spanRecordExceptionMock,
  setStatus: spanSetStatusMock,
}));

const contextActiveMock = vi.fn(() => ({}));
const contextWithMock = vi.fn((_ctx, fn: () => unknown) => fn());
const traceSetSpanMock = vi.fn((_ctx, span) => span);
const diagSetLoggerMock = vi.fn();

const counterAddMock = vi.fn();
const histogramRecordMock = vi.fn();
const meterInstance = {
  createCounter: vi.fn().mockReturnValue({ add: counterAddMock }),
  createHistogram: vi.fn().mockReturnValue({ record: histogramRecordMock }),
};

vi.mock('@opentelemetry/api', () => ({
  context: {
    active: contextActiveMock,
    with: contextWithMock,
  },
  trace: {
    getTracer: vi.fn(() => ({ startSpan: tracerStartSpanMock })),
    setSpan: traceSetSpanMock,
  },
  SpanStatusCode: { ERROR: 'ERROR' },
  diag: { setLogger: diagSetLoggerMock },
  DiagConsoleLogger: class {},
  DiagLogLevel: { ERROR: 0 },
}));

const batchShutdownMock = vi.fn();
const tracerRegisterMock = vi.fn();
const tracerShutdownMock = vi.fn();

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: class {
    constructor(public readonly exporter: unknown, public readonly options: Record<string, unknown>) {
      edgeTestState.batchProcessorOptions.push(options);
    }

    shutdown = batchShutdownMock.mockResolvedValue(undefined);
  },
  BasicTracerProvider: class {
    constructor(public readonly options: Record<string, unknown>) {
      edgeTestState.tracerProviderConfigs.push(options);
    }

    addSpanProcessor = vi.fn();
    register = tracerRegisterMock;
    shutdown = tracerShutdownMock.mockResolvedValue(undefined);
  },
}));

const meterShutdownMock = vi.fn();

vi.mock('@opentelemetry/sdk-metrics', () => ({
  MeterProvider: class {
    constructor(public readonly options: Record<string, unknown>) {
      edgeTestState.meterProviderConfigs.push(options);
    }

    addMetricReader = vi.fn();
    getMeter = vi.fn(() => meterInstance);
    shutdown = meterShutdownMock.mockResolvedValue(undefined);
  },
  PeriodicExportingMetricReader: class {
    constructor(public readonly options: Record<string, unknown>) {
      metricReaderConfigs.push(options);
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

vi.mock('@opentelemetry/resources', () => ({
  Resource: class {
    constructor(public readonly attributes: Record<string, unknown>) {
      edgeTestState.resources.push(attributes);
    }
  },
}));

const edgeTestState = {
  resources: [] as Array<Record<string, unknown>>,
  tracerProviderConfigs: [] as Array<Record<string, unknown>>,
  batchProcessorOptions: [] as Array<Record<string, unknown>>,
  meterProviderConfigs: [] as Array<Record<string, unknown>>,
};

const denoEnvGetMock = vi.fn((key: string) => denoEnvValues[key]);
let denoEnvValues: Record<string, string | undefined> = {};
const originalServeMock = vi.fn((...args: any[]) => {
  const handler = args.length === 1 ? args[0] : args[1];
  return Promise.resolve(
    handler(new Request('https://example.test/resource'), { remoteAddr: { hostname: '127.0.0.1' } } as any),
  );
});

beforeEach(() => {
  traceExporterConfigs.length = 0;
  metricExporterConfigs.length = 0;
  metricReaderConfigs.length = 0;
  edgeTestState.resources.length = 0;
  edgeTestState.tracerProviderConfigs.length = 0;
  edgeTestState.batchProcessorOptions.length = 0;
  edgeTestState.meterProviderConfigs.length = 0;
  spanEndMock.mockReset();
  spanRecordExceptionMock.mockReset();
  spanSetStatusMock.mockReset();
  tracerStartSpanMock.mockReset();
  contextActiveMock.mockReset();
  contextWithMock.mockReset();
  traceSetSpanMock.mockReset();
  diagSetLoggerMock.mockReset();
  counterAddMock.mockReset();
  histogramRecordMock.mockReset();
  meterInstance.createCounter.mockReset().mockReturnValue({ add: counterAddMock });
  meterInstance.createHistogram.mockReset().mockReturnValue({ record: histogramRecordMock });
  batchShutdownMock.mockReset().mockResolvedValue(undefined);
  tracerRegisterMock.mockReset();
  tracerShutdownMock.mockReset().mockResolvedValue(undefined);
  meterShutdownMock.mockReset().mockResolvedValue(undefined);
  metricReaderConfigs.length = 0;
  denoEnvValues = {};
  denoEnvGetMock.mockReset().mockImplementation((key) => denoEnvValues[key]);
  originalServeMock.mockReset().mockImplementation((...args: any[]) => {
    const handler = args.length === 1 ? args[0] : args[1];
    return Promise.resolve(
      handler(new Request('https://example.test/resource'), { remoteAddr: { hostname: '127.0.0.1' } } as any),
    );
  });
  (globalThis as any).Deno = { env: { get: denoEnvGetMock }, serve: originalServeMock };
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as any).Deno;
});

describe('edge telemetry helpers', () => {
  it('throws if meter requested before init', async () => {
    const { getEdgeMeter } = await import('../src/edge.js');
    expect(() => getEdgeMeter()).toThrowError(/not been initialised/);
  });

  it('initialises exporters and patches Deno.serve', async () => {
    const { initEdgeTelemetry, getEdgeMeter } = await import('../src/edge.js');

    const runtime = await initEdgeTelemetry({
      serviceName: 'edge-service',
      otlpEndpoint: 'https://edge-collector',
      metricsEndpoint: 'https://edge-metrics',
      headers: { Authorization: 'Edge token', empty: '' },
    });

    expect(traceExporterConfigs[0]).toEqual({ url: 'https://edge-collector/v1/traces', headers: { Authorization: 'Edge token' } });
    expect(metricExporterConfigs[0]).toEqual({ url: 'https://edge-metrics/v1/metrics', headers: { Authorization: 'Edge token' } });
    expect(metricReaderConfigs[0]).toMatchObject({ exportIntervalMillis: 20_000 });
    expect(edgeTestState.resources[0]).toMatchObject({ 'service.name': 'edge-service' });

    const meter = getEdgeMeter();
    expect(meter).toEqual(meterInstance);

    const response = await (globalThis as any).Deno.serve(() => new Response('ok', { status: 204 }));
    expect(response.status).toBe(204);
    expect(counterAddMock).toHaveBeenCalledWith(1, expect.objectContaining({ 'http.status_code': 204 }));

    await runtime.shutdown();
    expect(meterShutdownMock).toHaveBeenCalledTimes(1);
    expect(batchShutdownMock).toHaveBeenCalledTimes(1);
    expect(tracerShutdownMock).toHaveBeenCalledTimes(1);
  });

  it('records span exceptions via withEdgeSpan', async () => {
    const { initEdgeTelemetry, withEdgeSpan } = await import('../src/edge.js');

    await initEdgeTelemetry({ serviceName: 'edge-service', otlpEndpoint: 'https://edge' });

    await expect(
      withEdgeSpan('edge.test', { feature: 'compliance' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrowError('boom');

    expect(spanRecordExceptionMock).toHaveBeenCalledTimes(1);
    expect(spanSetStatusMock).toHaveBeenCalledWith({ code: 'ERROR', message: 'boom' });
  });
});
