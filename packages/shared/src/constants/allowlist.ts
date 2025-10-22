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

export const DEFAULT_WEB_SEARCH_ALLOWLIST_MAX = 20;

type AllowlistInput = readonly unknown[] | null | undefined;

function normalizeDomains(domains: AllowlistInput): string[] {
  if (!domains || domains.length === 0) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of domains) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = entry.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export interface BuildWebSearchAllowlistOptions {
  fallback: readonly string[];
  override?: AllowlistInput;
  maxDomains?: number;
  onTruncate?: (details: {
    truncatedCount: number;
    totalDomains: number;
    maxDomains: number;
    source: 'override' | 'fallback';
  }) => void;
}

export interface BuildWebSearchAllowlistResult {
  allowlist: string[];
  truncated: boolean;
  truncatedCount: number;
  totalDomains: number;
  source: 'override' | 'fallback';
}

export function buildWebSearchAllowlist(
  options: BuildWebSearchAllowlistOptions,
): BuildWebSearchAllowlistResult {
  const fallback = normalizeDomains(options.fallback);
  const override = normalizeDomains(options.override);
  const source: 'override' | 'fallback' = override.length > 0 ? 'override' : 'fallback';
  const candidate = source === 'override' ? override : fallback;
  const maxDomains = options.maxDomains ?? DEFAULT_WEB_SEARCH_ALLOWLIST_MAX;

  if (candidate.length <= maxDomains) {
    return {
      allowlist: candidate,
      truncated: false,
      truncatedCount: 0,
      totalDomains: candidate.length,
      source,
    };
  }

  const allowlist = candidate.slice(0, maxDomains);
  const truncatedCount = candidate.length - allowlist.length;

  options.onTruncate?.({
    truncatedCount,
    totalDomains: candidate.length,
    maxDomains,
    source,
  });

  return {
    allowlist,
    truncated: true,
    truncatedCount,
    totalDomains: candidate.length,
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
