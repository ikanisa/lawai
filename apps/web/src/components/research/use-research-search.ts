import { useQuery } from '@tanstack/react-query';

type Primitive = string | number | boolean;

function serializeAttributes(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort()
    .join(',');
}

export interface ResearchSearchRequest {
  query: string;
  scoreThreshold: number;
  attributes: string[];
  rewrite: boolean;
}

export interface ResearchSearchResult {
  id: string;
  title: string;
  summary: string;
  score: number;
  attributes: string[];
}

export interface ResearchSearchResponse {
  results: ResearchSearchResult[];
}

export interface UseResearchSearchOptions extends ResearchSearchRequest {
  enabled?: boolean;
}

function createQueryKey(params: ResearchSearchRequest): readonly Primitive[] {
  const threshold = Number.isFinite(params.scoreThreshold) ? params.scoreThreshold : 0;
  const attributesKey = serializeAttributes(params.attributes);

  return [
    'research',
    'search',
    params.query,
    threshold,
    attributesKey,
    params.rewrite,
  ] as const;
}

function buildSearchUrl(params: ResearchSearchRequest): string {
  const search = new URLSearchParams();
  search.set('q', params.query);

  const clampedThreshold = Math.min(100, Math.max(0, Math.round(params.scoreThreshold)));
  search.set('score_threshold', String(clampedThreshold));

  const attributes = serializeAttributes(params.attributes);
  if (attributes) {
    search.set('attributes', attributes);
  }

  search.set('rewrite', params.rewrite ? 'true' : 'false');

  return `/api/research/search?${search.toString()}`;
}

async function fetchResearchResults(params: ResearchSearchRequest, signal?: AbortSignal): Promise<ResearchSearchResponse> {
  const url = buildSearchUrl(params);
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error('research_search_failed');
  }

  const data = (await response.json()) as ResearchSearchResponse;
  if (!data || !Array.isArray(data.results)) {
    return { results: [] };
  }

  return {
    results: data.results.map((result) => ({
      ...result,
      attributes: Array.isArray(result.attributes) ? result.attributes : [],
    })),
  };
}

export function useResearchSearch({ enabled, ...params }: UseResearchSearchOptions) {
  const shouldEnable = enabled ?? params.query.trim().length > 0;

  return useQuery({
    queryKey: createQueryKey(params),
    queryFn: ({ signal }) => fetchResearchResults(params, signal),
    enabled: shouldEnable,
    staleTime: 1000 * 30,
    keepPreviousData: true,
    suspense: false,
  });
}

export const __internal = {
  buildSearchUrl,
  createQueryKey,
  serializeAttributes,
};
