export const OFFICIAL_DOMAIN_REGISTRY: Readonly<Record<string, readonly string[]>> = {
  'legifrance.gouv.fr': ['FR'],
  'courdecassation.fr': ['FR'],
  'conseil-etat.fr': ['FR'],
  'justel.fgov.be': ['BE'],
  'moniteur.be': ['BE'],
  'ejustice.fgov.be': ['BE'],
  'legilux.public.lu': ['LU'],
  'legimonaco.mc': ['MC'],
  'fedlex.admin.ch': ['CH'],
  'bger.ch': ['CH'],
  'legisquebec.gouv.qc.ca': ['CA-QC'],
  'canlii.org': ['CA-QC'],
  'laws-lois.justice.gc.ca': ['CA-QC', 'CA'],
  'scc-csc.ca': ['CA'],
  'scc-csc.lexum.com': ['CA'],
  'ohada.org': ['OHADA'],
  'sgg.gov.ma': ['MA'],
  'iort.gov.tn': ['TN'],
  'joradp.dz': ['DZ'],
  'eur-lex.europa.eu': ['EU'],
  'oapi.int': ['OAPI'],
  'cima-afrique.org': ['CIMA'],
};

export const OFFICIAL_DOMAIN_ALLOWLIST: readonly string[] = Object.keys(OFFICIAL_DOMAIN_REGISTRY);

const DEFAULT_WEB_SEARCH_LIMIT = 20;

function normaliseAllowlistInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? (() => {
        try {
          return new URL(trimmed).hostname;
        } catch (error) {
          return trimmed;
        }
      })()
    : trimmed;

  const lower = candidate.toLowerCase().replace(/^\.+/, '');
  if (!lower) {
    return null;
  }

  // Basic hostname validation – reject values with spaces or protocol separators.
  if (/[\s/]/.test(lower)) {
    return null;
  }

  return lower;
}

export type WebSearchAllowlistSource = 'base' | 'override';

export interface WebSearchAllowlistResult {
  allowlist: string[];
  total: number;
  truncated: boolean;
  truncatedDomains: string[];
  limit: number;
  source: WebSearchAllowlistSource;
}

export interface BuildWebSearchAllowlistOptions {
  base?: readonly string[];
  override?: readonly unknown[] | null;
  limit?: number;
}

export function buildWebSearchAllowlist(
  options: BuildWebSearchAllowlistOptions = {},
): WebSearchAllowlistResult {
  const limit = Math.max(1, options.limit ?? DEFAULT_WEB_SEARCH_LIMIT);
  const base = Array.isArray(options.base) ? options.base : OFFICIAL_DOMAIN_ALLOWLIST;

  const override = Array.isArray(options.override) ? options.override : null;
  const hasOverride = override !== null;
  const source: WebSearchAllowlistSource = hasOverride ? 'override' : 'base';
  const inputs = hasOverride ? override : base;

  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of inputs) {
    const host = normaliseAllowlistInput(value);
    if (!host || seen.has(host)) {
      continue;
    }
    seen.add(host);
    deduped.push(host);
  }

  const allowlist = deduped.slice(0, limit);
  const truncatedDomains = deduped.slice(limit);

  return {
    allowlist,
    total: deduped.length,
    truncated: truncatedDomains.length > 0,
    truncatedDomains,
    limit,
    source,
  };
}

export function isDomainAllowlisted(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return getJurisdictionsForDomain(hostname).length > 0;
  } catch (error) {
    return false;
  }
}

export function getJurisdictionsForDomain(hostname: string): string[] {
  const normalized = hostname.toLowerCase();

  for (const [allowed, jurisdictions] of Object.entries(OFFICIAL_DOMAIN_REGISTRY)) {
    if (normalized === allowed || normalized.endsWith(`.${allowed}`)) {
      return [...jurisdictions];
    }
  }

  return [];
}
