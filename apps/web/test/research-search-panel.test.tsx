import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchPanel } from '@/components/research/search-panel';
import type { ResearchSearchResult } from '@/components/research/use-research-search';

const SAMPLE_RESULTS: ResearchSearchResult[] = [
  {
    id: '1',
    title: 'Official source with high score',
    summary: 'A primary law reference with strong relevance.',
    score: 95,
    attributes: ['official', 'primary'],
  },
  {
    id: '2',
    title: 'Doctrine analysis',
    summary: 'Scholarly commentary on the relevant article.',
    score: 72,
    attributes: ['doctrine'],
  },
  {
    id: '3',
    title: 'Low score citation',
    summary: 'Tangentially related case summary.',
    score: 48,
    attributes: ['jurisprudence'],
  },
];

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsed = new URL(url, 'https://example.com');
    const threshold = Number(parsed.searchParams.get('score_threshold') ?? '0');
    const attributesParam = parsed.searchParams.get('attributes');
    const rewriteParam = parsed.searchParams.get('rewrite');

    const selectedAttributes = attributesParam ? attributesParam.split(',') : [];

    const filtered = SAMPLE_RESULTS.filter((result) => {
      const meetsScore = result.score >= threshold;
      const matchesAttributes =
        selectedAttributes.length === 0 || selectedAttributes.some((attribute) => result.attributes.includes(attribute));
      return meetsScore && matchesAttributes;
    });

    return {
      ok: true,
      json: async () => ({
        results: filtered.map((result) => ({
          ...result,
          summary: rewriteParam === 'true' ? `${result.summary} (rewritten)` : result.summary,
        })),
      }),
    } as Response;
  });
}

function renderSearchPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, suspense: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SearchPanel
        initialQuery="contract"
        initialScoreThreshold={60}
        attributeOptions={[
          { value: 'official', label: 'Official' },
          { value: 'doctrine', label: 'Doctrine' },
          { value: 'jurisprudence', label: 'Case law' },
        ]}
      />
    </QueryClientProvider>,
  );
}

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('threads controls through query params for research search', async () => {
    const fetchMock = global.fetch as ReturnType<typeof createFetchMock>;
    const user = userEvent.setup();

    renderSearchPanel();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const scoreInput = await screen.findByLabelText('Score threshold', { selector: 'input' });
    const doctrineButton = screen.getByRole('button', { name: 'Doctrine' });
    const rewriteSwitch = screen.getByRole('switch', { name: 'Disabled' });

    await user.clear(scoreInput);
    await user.type(scoreInput, '90');

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain('score_threshold=90');
    });

    await user.click(doctrineButton);

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain('attributes=doctrine');
    });

    await user.click(rewriteSwitch);

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain('rewrite=true');
    });
  });

  it('renders filtered search results when adjusting controls', async () => {
    const user = userEvent.setup();

    renderSearchPanel();

    await screen.findByText('Official source with high score');
    expect(screen.queryByText('Low score citation')).not.toBeInTheDocument();

    const scoreInput = await screen.findByLabelText('Score threshold', { selector: 'input' });
    await user.clear(scoreInput);
    await user.type(scoreInput, '93');

    await waitFor(() => {
      expect(screen.queryByText('Doctrine analysis')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Official source with high score')).toBeInTheDocument();

    const doctrineButton = screen.getByRole('button', { name: 'Doctrine' });
    await user.click(doctrineButton);

    await waitFor(() => {
      expect(screen.getByText('Doctrine analysis')).toBeInTheDocument();
      expect(screen.queryByText('Official source with high score')).not.toBeInTheDocument();
    });
  });
});
