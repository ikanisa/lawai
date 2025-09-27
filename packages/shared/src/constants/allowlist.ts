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
