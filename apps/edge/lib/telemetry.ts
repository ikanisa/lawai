const TRACE_ENDPOINT = Deno.env.get('OTEL_EXPORTER_OTLP_ENDPOINT') ?? '';
const METRICS_ENDPOINT = Deno.env.get('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT') ?? TRACE_ENDPOINT;
const OTEL_HEADERS = parseHeaders(Deno.env.get('OTEL_EXPORTER_OTLP_HEADERS'));
const SERVICE_NAME = Deno.env.get('OTEL_SERVICE_NAME') ?? 'edge-functions';

function parseHeaders(input: string | undefined | null): Record<string, string> {
  if (!input) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const segment of input.split(',')) {
    const [key, value] = segment.split('=').map((part) => part.trim());
    if (key && value) {
      headers[key] = value;
    }
  }
  return headers;
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('');
}

function parseTraceparent(header: string | null): { traceId: string; parentSpanId: string | null } | null {
  if (!header) {
    return null;
  }
  const match = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-/i);
  if (!match) {
    return null;
  }
  return { traceId: match[1], parentSpanId: match[2] };
}

function toAttributeValue(value: unknown): { key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } } | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return { key: '', value: { stringValue: value } };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return { key: '', value: { intValue: String(value) } };
    }
    return { key: '', value: { doubleValue: value } };
  }
  if (typeof value === 'boolean') {
    return { key: '', value: { boolValue: value } };
  }
  return { key: '', value: { stringValue: JSON.stringify(value) } };
}

function formatAttributes(attributes: Record<string, unknown>): Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }> {
  const entries: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }> = [];
  for (const [key, raw] of Object.entries(attributes)) {
    const value = toAttributeValue(raw);
    if (value) {
      entries.push({ key, value: value.value });
    }
  }
  return entries;
}

async function exportSpan(span: {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, unknown>;
  statusCode: 0 | 1 | 2;
  statusMessage?: string;
}) {
  if (!TRACE_ENDPOINT) {
    return;
  }
  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: formatAttributes({ 'service.name': SERVICE_NAME, 'telemetry.sdk.language': 'deno' }),
        },
        scopeSpans: [
          {
            scope: { name: 'edge.handler' },
            spans: [
              {
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId ?? undefined,
                name: span.name,
                kind: 1,
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: span.endTimeUnixNano,
                attributes: formatAttributes(span.attributes),
                status: {
                  code: span.statusCode,
                  message: span.statusMessage,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(`${TRACE_ENDPOINT.replace(/\/$/, '')}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...OTEL_HEADERS },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('edge_trace_export_failed', error);
  }
}

async function exportMetric(
  name: string,
  value: number,
  timestamps: { start: string; end: string },
  attributes: Record<string, unknown>,
) {
  if (!METRICS_ENDPOINT) {
    return;
  }
  const body = {
    resourceMetrics: [
      {
        resource: {
          attributes: formatAttributes({ 'service.name': SERVICE_NAME, 'telemetry.sdk.language': 'deno' }),
        },
        scopeMetrics: [
          {
            scope: { name: 'edge.handler' },
            metrics: [
              {
                name,
                unit: '1',
                sum: {
                  aggregationTemporality: 2,
                  isMonotonic: true,
                  dataPoints: [
                    {
                      startTimeUnixNano: timestamps.start,
                      timeUnixNano: timestamps.end,
                      asInt: String(Math.trunc(value)),
                      attributes: formatAttributes(attributes),
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(`${METRICS_ENDPOINT.replace(/\/$/, '')}/v1/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...OTEL_HEADERS },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('edge_metric_export_failed', error);
  }
}

function toUnixNano(timestamp: number): string {
  return (BigInt(Math.floor(timestamp)) * 1_000_000n).toString();
}

export function instrumentEdgeHandler(
  name: string,
  handler: (request: Request, info: Deno.ServeHandlerInfo) => Promise<Response> | Response,
): (request: Request, info: Deno.ServeHandlerInfo) => Promise<Response> {
  return async (request, info) => {
    const traceHeader = request.headers.get('traceparent');
    const context = parseTraceparent(traceHeader);
    const traceId = context?.traceId ?? randomHex(16);
    const spanId = randomHex(8);
    const startWallClock = Date.now();
    const startPerf = performance.now();
    const startTime = toUnixNano(startWallClock);

    try {
      const response = await handler(request, info);
      const durationNs = BigInt(Math.max(0, Math.round((performance.now() - startPerf) * 1_000_000)));
      const endTime = (BigInt(startTime) + durationNs).toString();
      await exportSpan({
        traceId,
        spanId,
        parentSpanId: context?.parentSpanId ?? null,
        name,
        startTimeUnixNano: startTime,
        endTimeUnixNano: endTime,
        attributes: {
          'http.method': request.method,
          'http.status_code': response.status,
          'edge.function.name': name,
        },
        statusCode: response.status >= 500 ? 2 : 1,
      });
      await exportMetric('edge.requests', 1, { start: startTime, end: endTime }, { 'edge.function.name': name });
      return response;
    } catch (error) {
      const durationNs = BigInt(Math.max(0, Math.round((performance.now() - startPerf) * 1_000_000)));
      const endTime = (BigInt(startTime) + durationNs).toString();
      await exportSpan({
        traceId,
        spanId,
        parentSpanId: context?.parentSpanId ?? null,
        name,
        startTimeUnixNano: startTime,
        endTimeUnixNano: endTime,
        attributes: {
          'http.method': request.method,
          'edge.function.name': name,
          'error.type': error instanceof Error ? error.name : typeof error,
        },
        statusCode: 2,
        statusMessage: error instanceof Error ? error.message : String(error),
      });
      await exportMetric('edge.requests', 1, { start: startTime, end: endTime }, {
        'edge.function.name': name,
        status: 'error',
      });
      throw error;
    }
  };
}
