import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';

vi.mock('../src/observability/metrics.js', () => ({
  incrementCounter: vi.fn(),
}));

import { buildWebSearchAllowlist } from '../src/tools/web-search-allowlist.js';
import type { AllowlistLogger } from '../src/tools/web-search-allowlist.js';
import { incrementCounter } from '../src/observability/metrics.js';

const incrementCounterMock = incrementCounter as unknown as vi.Mock;

beforeEach(() => {
  incrementCounterMock.mockClear();
});

describe('buildWebSearchAllowlist', () => {
  it('deduplicates and normalises domains', () => {
    const { allowlist } = buildWebSearchAllowlist({
      domains: ['https://Legifrance.gouv.fr/code', 'legifrance.gouv.fr', 'OHADA.org', 'ohada.org'],
    });

    expect(allowlist.filter((domain) => domain === 'legifrance.gouv.fr')).toHaveLength(1);
    expect(allowlist.filter((domain) => domain === 'ohada.org')).toHaveLength(1);
  });

  it('orders domains using jurisdiction weights before falling back to lexicographical sorting', () => {
    const { allowlist } = buildWebSearchAllowlist({
      domains: ['ohada.org', 'oapi.int', 'example.com', 'legifrance.gouv.fr'],
    });

    expect(allowlist[0]).toBe('legifrance.gouv.fr');
    expect(allowlist[1]).toBe('ohada.org');
    expect(allowlist[2]).toBe('oapi.int');
    expect(allowlist.at(-1)).toBe('example.com');
  });

  it('produces deterministic results regardless of input ordering', () => {
    const reversed = [...OFFICIAL_DOMAIN_ALLOWLIST].reverse();
    const first = buildWebSearchAllowlist({ domains: reversed }).allowlist;
    const second = buildWebSearchAllowlist({ domains: reversed }).allowlist;

    expect(second).toEqual(first);
  });

  it('chunks long lists into 20-element slices and records telemetry', () => {
    const logger: AllowlistLogger = { debug: vi.fn(), warn: vi.fn() };

    const { chunks, allowlist } = buildWebSearchAllowlist({
      domains: OFFICIAL_DOMAIN_ALLOWLIST,
      logger,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(allowlist.length - 20);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'web_search_allowlist.chunked',
        chunkCount: chunks.length,
        chunkSize: 20,
        total: allowlist.length,
      }),
      expect.any(String),
    );
    expect(logger.warn).not.toHaveBeenCalled();

    expect(incrementCounterMock).toHaveBeenCalledWith(
      'web_search_allowlist.chunked',
      expect.objectContaining({ chunkCount: chunks.length, chunkSize: 20, total: allowlist.length }),
    );
  });

  it('truncates when exceeding max chunks and logs dropped domains', () => {
    const logger: AllowlistLogger = { debug: vi.fn(), warn: vi.fn() };
    const extras = Array.from({ length: 10 }, (_, index) => `extra-${index}.example.com`);

    const { allowlist, dropped, chunks } = buildWebSearchAllowlist({
      domains: [...OFFICIAL_DOMAIN_ALLOWLIST, ...extras],
      chunkSize: 5,
      maxChunks: 2,
      logger,
    });

    expect(allowlist.length).toBe(10);
    expect(chunks.length).toBe(2);
    expect(dropped.length).toBeGreaterThan(0);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'web_search_allowlist.truncated',
        total: OFFICIAL_DOMAIN_ALLOWLIST.length + extras.length,
        kept: allowlist.length,
        droppedCount: dropped.length,
        dropped,
      }),
      expect.any(String),
    );

    expect(incrementCounterMock).toHaveBeenCalledWith(
      'web_search_allowlist.truncated',
      expect.objectContaining({
        total: OFFICIAL_DOMAIN_ALLOWLIST.length + extras.length,
        kept: allowlist.length,
        dropped: dropped.length,
      }),
    );
  });
});
