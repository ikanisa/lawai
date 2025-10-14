/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '../../packages/shared/src/constants/allowlist.ts';

type SourceType = 'statute' | 'case' | 'gazette' | 'regulation';

type NormalizedDocument = {
  title: string;
  jurisdiction: string;
  sourceType: SourceType;
  publisher: string;
  canonicalUrl: string;
  downloadUrl: string;
  bindingLanguage: string;
  consolidated: boolean;
  adoptionDate?: string;
  effectiveDate?: string;
  versionLabel?: string;
  languageNote?: string;
  mimeType: string;
  etag?: string | null;
  lastModified?: string | null;
  eli?: string | null;
  ecli?: string | null;
  akomaNtoso?: Record<string, unknown> | null;
  residency?: string | null;
};

type Adapter = {
  id: string;
  description: string;
  fetchDocuments: () => Promise<NormalizedDocument[]>;
};

type IngestionRunRecord = {
  id: string;
  adapterId: string;
};

interface CrawlRequestBody {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
  openaiApiKey?: string;
  vectorStoreId?: string;
}

interface IngestionSummary {
  adapterId: string;
  inserted: number;
  skipped: number;
  failures: number;
}

const textEncoder = new TextEncoder();

const DOMAIN_ALLOWLIST = new Set(
  Array.isArray(OFFICIAL_DOMAIN_ALLOWLIST) ? OFFICIAL_DOMAIN_ALLOWLIST.map((host) => host.toLowerCase()) : [],
);

const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/html': 'html',
};

const RESIDENCY_ZONE_MAP: Record<string, string> = {
  FR: 'eu',
  BE: 'eu',
  LU: 'eu',
  EU: 'eu',
  MC: 'eu',
  CH: 'ch',
  'CA-QC': 'ca',
  CA: 'ca',
  OHADA: 'ohada',
  MA: 'maghreb',
  TN: 'maghreb',
  DZ: 'maghreb',
  RW: 'rw',
};

function resolveResidencyZone(jurisdiction: string): string {
  const upper = jurisdiction.toUpperCase();
  return RESIDENCY_ZONE_MAP[upper] ?? 'ohada';
}

function deriveEli(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    const eliIndex = parts.indexOf('eli');
    if (eliIndex >= 0 && eliIndex + 1 < parts.length) {
      return parts.slice(eliIndex + 1).join('/');
    }
    if (parsed.hostname.includes('legisquebec.gouv.qc.ca') && parts.length >= 2) {
      return `legisquebec/${parts.slice(-2).join('/')}`;
    }
    if (parsed.hostname.includes('laws-lois.justice.gc.ca')) {
      return parts.join('/');
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function deriveEcli(url: string): string | null {
  if (/ECLI:/i.test(url)) {
    const match = url.match(/ECLI:([A-Z0-9:\-]+)/i);
    return match ? `ECLI:${match[1]}` : null;
  }
  if (/courdecassation\.be\/id\//i.test(url)) {
    const id = url.split('/id/')[1];
    return id ? `ECLI:BE:CSC:${id.toUpperCase()}` : null;
  }
  return null;
}

function buildAkomaNtoso(doc: NormalizedDocument, eli: string | null, ecli: string | null) {
  return {
    meta: {
      identification: {
        source: doc.publisher,
        jurisdiction: doc.jurisdiction,
        eli,
        ecli,
        workURI: doc.canonicalUrl,
      },
      publication: {
        adoptionDate: doc.adoptionDate ?? null,
        effectiveDate: doc.effectiveDate ?? null,
        capturedAt: new Date().toISOString(),
        consolidated: doc.consolidated,
        bindingLanguage: doc.bindingLanguage,
        languageNote: doc.languageNote ?? null,
      },
    },
  } as Record<string, unknown>;
}

function extensionForMime(mimeType: string): string {
  return MIME_EXTENSION[mimeType] ?? 'bin';
}

function extractHost(url: string): string | null {
  try {
    const { host } = new URL(url);
    return host.toLowerCase();
  } catch (_error) {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

function isHostAllowlisted(host: string | null): boolean {
  if (!host) {
    return false;
  }
  const normalized = host.toLowerCase();
  if (DOMAIN_ALLOWLIST.has(normalized)) {
    return true;
  }
  for (const allowed of DOMAIN_ALLOWLIST) {
    if (normalized.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

async function recordQuarantine(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  adapterId: string,
  doc: NormalizedDocument,
  reason: string,
  extra: Record<string, unknown> = {},
) {
  const metadata = {
    title: doc.title,
    jurisdiction: doc.jurisdiction,
    sourceType: doc.sourceType,
    bindingLanguage: doc.bindingLanguage,
    consolidated: doc.consolidated,
    languageNote: doc.languageNote ?? null,
    host: extractHost(doc.canonicalUrl) ?? null,
    ...extra,
  };

  try {
    await supabase
      .from('ingestion_quarantine')
      .upsert(
        {
          org_id: orgId,
          adapter_id: adapterId,
          source_url: doc.canonicalUrl ?? doc.downloadUrl,
          canonical_url: doc.canonicalUrl ?? null,
          reason,
          metadata,
        },
        { onConflict: 'org_id,source_url,reason' },
      );
  } catch (error) {
    console.warn('quarantine_insert_failed', error);
  }
}

async function toHexSha256(buffer: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type DownloadResult = {
  payload: Uint8Array;
  etag?: string | null;
  lastModified?: string | null;
};

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadDocument(doc: NormalizedDocument): Promise<DownloadResult> {
  const attempts = [0, 500, 1500];
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) await delay(attempts[i]);
    try {
      const response = await fetch(doc.downloadUrl, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const payload = new Uint8Array(arrayBuffer);
      if (payload.byteLength > 0) {
        return {
          payload,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
        };
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed to download ${doc.downloadUrl}:`, error);
    }
  }
  const fallback = `Document placeholder for ${doc.title} (${doc.canonicalUrl})`;
  return {
    payload: textEncoder.encode(fallback),
    etag: doc.etag ?? null,
    lastModified: doc.lastModified ?? null,
  };
}

async function loadFixture(name: string): Promise<NormalizedDocument[]> {
  try {
    const url = new URL(`./fixtures/${name}.json`, import.meta.url);
    const text = await Deno.readTextFile(url);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as NormalizedDocument[];
    }
  } catch (error) {
    console.warn(`Unable to load fixture ${name}:`, error);
  }
  return [];
}

async function fetchRemoteJson(url: string): Promise<NormalizedDocument[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as unknown;
    if (Array.isArray(json)) {
      return json as NormalizedDocument[];
    }
  } catch (error) {
    console.warn(`Remote dataset unavailable for ${url}:`, error);
  }
  return [];
}

async function fetchRssDocuments(
  url: string,
  mapper: (item: { title?: string | null; link?: string | null; pubDate?: string | null }) => NormalizedDocument | null,
  limit = 10,
): Promise<NormalizedDocument[]> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9' } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, limit);
    const mapped = items
      .map((match) => match[1] ?? '')
      .map((block) => {
        const title = extractXmlValue(block, 'title');
        const link = extractXmlValue(block, 'link');
        const pubDate = extractXmlValue(block, 'pubDate');
        return mapper({ title, link, pubDate });
      })
      .filter((value): value is NormalizedDocument => value !== null);
    return mapped;
  } catch (error) {
    console.warn(`Unable to parse RSS feed ${url}:`, error);
  }
  return [];
}

async function fetchFirstAvailableRss(
  urls: readonly string[],
  mapper: (item: { title?: string | null; link?: string | null; pubDate?: string | null }) => NormalizedDocument | null,
  limit = 10,
): Promise<NormalizedDocument[]> {
  for (const url of urls) {
    const docs = await fetchRssDocuments(url, mapper, limit);
    if (docs.length > 0) {
      return docs;
    }
  }
  return [];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function extractXmlValue(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(regex);
  if (!match) {
    return null;
  }
  return decodeHtmlEntities(match[1]);
}

function dedupeDocuments(documents: NormalizedDocument[]): NormalizedDocument[] {
  const seen = new Set<string>();
  const result: NormalizedDocument[] = [];
  for (const doc of documents) {
    const key = doc.canonicalUrl.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(doc);
    }
  }
  return result;
}

async function fetchLegifranceRssDocuments(limit = 8): Promise<NormalizedDocument[]> {
  try {
    const response = await fetch('https://www.legifrance.gouv.fr/rss/jorf.xml', {
      headers: { Accept: 'application/rss+xml' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, limit);
    return items
      .map((match) => match[1] ?? '')
      .map((block) => {
        const title = extractXmlValue(block, 'title');
        const link = extractXmlValue(block, 'link');
        const date = extractXmlValue(block, 'pubDate');
        if (!title || !link) {
          return null;
        }
        return {
          title,
          jurisdiction: 'FR',
          sourceType: 'gazette' as const,
          publisher: 'Légifrance',
          canonicalUrl: link,
          downloadUrl: link,
          bindingLanguage: 'fr',
          consolidated: false,
          effectiveDate: date ? new Date(date).toISOString().slice(0, 10) : undefined,
          versionLabel: 'Journal officiel (RSS)',
          mimeType: 'text/html',
          residency: 'eu',
        } satisfies NormalizedDocument;
      })
      .filter((value): value is NormalizedDocument => Boolean(value));
  } catch (error) {
    console.warn('Legifrance RSS unavailable', error);
    return [];
  }
}

async function fetchJustelRssDocuments(limit = 8): Promise<NormalizedDocument[]> {
  const docs = await fetchRssDocuments(
    'https://www.ejustice.just.fgov.be/cgi/rss_lg.pl?language=fr&la=F&view=justel',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'BE',
        sourceType: 'regulation',
        publisher: 'Moniteur belge',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr',
        consolidated: false,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux RSS Justel',
        mimeType: 'text/html',
        residency: 'eu',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (docs.length === 0) {
    return loadFixture('justel');
  }
  return docs;
}

async function fetchLegiluxRssDocuments(limit = 8): Promise<NormalizedDocument[]> {
  const docs = await fetchRssDocuments(
    'https://legilux.public.lu/opendata/jo/jo.rss',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'LU',
        sourceType: 'regulation',
        publisher: 'Legilux',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr',
        consolidated: false,
        adoptionDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux RSS Legilux',
        mimeType: 'text/html',
        residency: 'eu',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (docs.length === 0) {
    return loadFixture('legilux');
  }
  return docs;
}

async function fetchFedlexAtomDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const docs = await fetchRssDocuments(
    'https://www.fedlex.admin.ch/opendata/feed/fr/cc',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CH',
        sourceType: 'statute',
        publisher: 'Fedlex',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr',
        consolidated: true,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux Fedlex',
        mimeType: 'text/html',
        residency: 'ch',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (docs.length === 0) {
    return loadFixture('fedlex');
  }
  return docs;
}

function normaliseDataset(
  entries: NormalizedDocument[],
  overrides: Partial<NormalizedDocument>,
  limit?: number,
): NormalizedDocument[] {
  const result: NormalizedDocument[] = [];
  for (const entry of entries) {
    const merged = { ...entry, ...overrides } as NormalizedDocument;
    if (!merged.bindingLanguage) {
      merged.bindingLanguage = overrides.bindingLanguage ?? 'fr';
    }
    if (!merged.mimeType) {
      merged.mimeType = overrides.mimeType ?? 'text/html';
    }
    merged.residency = (merged.residency ?? overrides.residency ?? resolveResidencyZone(merged.jurisdiction)).toLowerCase();
    result.push(merged);
    if (limit && result.length >= limit) {
      break;
    }
  }
  return result;
}

async function fetchLegisQuebecDocuments(limit = 8): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchFirstAvailableRss(
    [
      'https://www.legisquebec.gouv.qc.ca/fr/rss/chapitres',
      'https://www.legisquebec.gouv.qc.ca/fr/rss/publications',
    ],
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CA-QC',
        sourceType: 'statute',
        publisher: 'LégisQuébec',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr/en',
        consolidated: true,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux LégisQuébec',
        mimeType: 'text/html',
        residency: 'ca',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const remote = await fetchRemoteJson(
    'https://raw.githubusercontent.com/open-legal-data/francophone-law-docs/refs/heads/main/legisquebec.json',
  );
  if (remote.length > 0) {
    return normaliseDataset(remote, { jurisdiction: 'CA-QC', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
  }
  const fixture = await loadFixture('legisquebec');
  return normaliseDataset(fixture, { jurisdiction: 'CA-QC', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
}

async function fetchCanLiiDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchFirstAvailableRss(
    [
      'https://www.canlii.org/fr/qc/rss.xml',
      'https://www.canlii.org/fr/ca/rss.xml',
    ],
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CA-QC',
        sourceType: 'case',
        publisher: 'CanLII',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr/en',
        consolidated: false,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux CanLII',
        mimeType: 'text/html',
        residency: 'ca',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const remote = await fetchRemoteJson(
    'https://raw.githubusercontent.com/open-legal-data/francophone-law-docs/refs/heads/main/canlii.json',
  );
  if (remote.length > 0) {
    return normaliseDataset(remote, { jurisdiction: 'CA-QC', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
  }
  const fixture = await loadFixture('canlii');
  return normaliseDataset(fixture, { jurisdiction: 'CA-QC', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
}

async function fetchJusticeLawsDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchFirstAvailableRss(
    [
      'https://laws-lois.justice.gc.ca/eng/XML/rss.xml',
      'https://laws-lois.justice.gc.ca/eng/rss.xml',
    ],
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CA',
        sourceType: 'statute',
        publisher: 'Justice Laws Website',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr/en',
        consolidated: true,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'Flux Justice Laws',
        mimeType: 'text/html',
        residency: 'ca',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const remote = await fetchRemoteJson(
    'https://raw.githubusercontent.com/open-legal-data/francophone-law-docs/refs/heads/main/justicelaws.json',
  );
  if (remote.length > 0) {
    return normaliseDataset(remote, { jurisdiction: 'CA', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
  }
  const fixture = await loadFixture('justicelaws');
  return normaliseDataset(fixture, { jurisdiction: 'CA', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
}

async function fetchSupremeCourtDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchRssDocuments(
    'https://www.scc-csc.ca/case-dossier/cms-sgd/rss/fra.xml',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CA',
        sourceType: 'case',
        publisher: 'Cour suprême du Canada',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr/en',
        languageNote: 'Motifs disponibles en français et en anglais.',
        consolidated: false,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'RSS CSC',
        mimeType: 'text/html',
        residency: 'ca',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const fixture = await loadFixture('scc');
  return normaliseDataset(fixture, { jurisdiction: 'CA', residency: 'ca', bindingLanguage: 'fr/en' }, limit);
}

async function fetchTribunalFederalDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchRssDocuments(
    'https://www.bger.ch/ext/eurospider/live/fr/php/rss.php',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'CH',
        sourceType: 'case',
        publisher: 'Tribunal fédéral',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr',
        consolidated: false,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'RSS Tribunal fédéral',
        mimeType: 'text/html',
        residency: 'ch',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const fixture = await loadFixture('tribunalfederal');
  return normaliseDataset(fixture, { jurisdiction: 'CH', residency: 'ch', bindingLanguage: 'fr' }, limit);
}

async function fetchCcjaDocuments(limit = 6): Promise<NormalizedDocument[]> {
  const rssDocs = await fetchRssDocuments(
    'https://www.ohada.org/index.php/fr/ccja/jurisprudence?format=feed&type=rss',
    ({ title, link, pubDate }) => {
      if (!title || !link) {
        return null;
      }
      return {
        title,
        jurisdiction: 'OHADA',
        sourceType: 'case',
        publisher: 'CCJA',
        canonicalUrl: link,
        downloadUrl: link,
        bindingLanguage: 'fr',
        consolidated: false,
        effectiveDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : undefined,
        versionLabel: 'RSS CCJA',
        mimeType: 'text/html',
        residency: 'ohada',
      } satisfies NormalizedDocument;
    },
    limit,
  );
  if (rssDocs.length > 0) {
    return rssDocs;
  }
  const fixture = await loadFixture('ccja');
  return normaliseDataset(fixture, { jurisdiction: 'OHADA', residency: 'ohada', bindingLanguage: 'fr' }, limit);
}

async function fetchGazettesAfricaDocuments(
  apiCountry: string,
  jurisdiction: string,
  bindingLanguage: string,
  languageNote: string,
  limit = 5,
): Promise<NormalizedDocument[]> {
  try {
    const url = `https://api.gazettes.africa/v1/gazettes/?country=${apiCountry}&ordering=-publication_date&page_size=${limit}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { results?: Array<Record<string, unknown>> };
    const results = json.results ?? [];
    return results
      .map((entry) => {
        const title = typeof entry.title === 'string' ? entry.title : null;
        const pdfUrl = typeof entry.file_url === 'string' ? entry.file_url : null;
        const webUrl = typeof entry.source_url === 'string' ? entry.source_url : pdfUrl;
        const pubDate = typeof entry.publication_date === 'string' ? entry.publication_date : null;
        if (!title || !webUrl || !pdfUrl) {
          return null;
        }
        return {
          title,
          jurisdiction,
          sourceType: 'gazette',
          publisher: 'Gazettes.Africa',
          canonicalUrl: webUrl,
          downloadUrl: pdfUrl,
          bindingLanguage,
          languageNote,
          consolidated: false,
          effectiveDate: pubDate ?? undefined,
          versionLabel: 'Gazettes Africa',
          mimeType: 'application/pdf',
        } satisfies NormalizedDocument;
      })
      .filter((value): value is NormalizedDocument => value !== null);
  } catch (error) {
    console.warn(`Unable to load Gazettes.Africa dataset for ${jurisdiction}:`, error);
  }
  return [];
}

async function fetchOhadaUniformActsRemote(): Promise<NormalizedDocument[]> {
  try {
    const response = await fetch('https://www.ohada.org/wp-json/wp/v2/document?per_page=50');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      return [];
    }

    return (json as Array<Record<string, unknown>>)
      .map((entry) => {
        const title = typeof entry?.title === 'object' && entry.title && 'rendered' in entry.title
          ? String((entry.title as { rendered?: unknown }).rendered ?? '')
          : typeof entry?.title === 'string'
            ? String(entry.title)
            : '';
        const link = typeof entry?.link === 'string' ? (entry.link as string) : '';
        if (!title || !link) {
          return null;
        }
        return {
          title: decodeHtmlEntities(title),
          jurisdiction: 'OHADA',
          sourceType: 'statute' as const,
          publisher: 'OHADA',
          canonicalUrl: link,
          downloadUrl: link,
          bindingLanguage: 'fr',
          consolidated: true,
          mimeType: 'text/html',
        } satisfies NormalizedDocument;
      })
      .filter((value): value is NormalizedDocument => Boolean(value));
  } catch (error) {
    console.warn('OHADA remote dataset unavailable', error);
    return [];
  }
}

async function uploadToVectorStore(
  vectorStoreId: string,
  apiKey: string,
  buffer: Uint8Array,
  mimeType: string,
  filename: string,
): Promise<string> {
  const fileUpload = new FormData();
  fileUpload.append('purpose', 'assistants');
  fileUpload.append('file', new Blob([buffer], { type: mimeType }), filename);

  const fileResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fileUpload,
  });

  const fileJson = await fileResponse.json();
  if (!fileResponse.ok) {
    throw new Error(fileJson.error?.message ?? 'Unable to upload file to OpenAI');
  }

  const attachResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_id: fileJson.id }),
  });

  const attachJson = await attachResponse.json();
  if (!attachResponse.ok) {
    throw new Error(attachJson.error?.message ?? 'Unable to attach file to vector store');
  }

  return fileJson.id as string;
}

async function loadRwandaDocuments(): Promise<NormalizedDocument[]> {
  const remote = await fetchRemoteJson(
    'https://raw.githubusercontent.com/open-legal-data/francophone-law-docs/refs/heads/main/rwanda.json',
  );
  const dataset = remote.length > 0 ? remote : await loadFixture('rwanda');
  return normaliseDataset(dataset, { jurisdiction: 'RW', residency: 'rw' });
}

function buildAdapters(): Adapter[] {
  const today = new Date().toISOString().split('T')[0];

  const ohadaUniformActs: NormalizedDocument[] = [
    {
      title: 'Acte uniforme relatif au droit comptable et à l’information financière (AUDCIF)',
      jurisdiction: 'OHADA',
      sourceType: 'statute',
      publisher: 'OHADA',
      canonicalUrl: 'https://www.ohada.org/index.php/fr/actes-uniformes/133-audcif',
      downloadUrl: 'https://www.ohada.org/wp-content/uploads/2023/01/AUDCIF-2017.pdf',
      bindingLanguage: 'fr',
      consolidated: true,
      adoptionDate: '2017-01-26',
      effectiveDate: '2018-01-01',
      versionLabel: 'Réforme 2017',
      mimeType: 'application/pdf',
      residency: 'ohada',
    },
    {
      title: 'Acte uniforme relatif au droit des sociétés commerciales et du GIE (AUSCGIE)',
      jurisdiction: 'OHADA',
      sourceType: 'statute',
      publisher: 'OHADA',
      canonicalUrl: 'https://www.ohada.org/index.php/fr/actes-uniformes/130-aus-cgie',
      downloadUrl: 'https://www.ohada.org/wp-content/uploads/2023/01/AUSCGIE-2014.pdf',
      bindingLanguage: 'fr',
      consolidated: true,
      adoptionDate: '2014-01-30',
      effectiveDate: '2014-05-05',
      versionLabel: 'Révision 2014',
      mimeType: 'application/pdf',
      residency: 'ohada',
    },
    {
      title: 'Acte uniforme sur les procédures collectives d’apurement du passif (AUPCAP)',
      jurisdiction: 'OHADA',
      sourceType: 'statute',
      publisher: 'OHADA',
      canonicalUrl: 'https://www.ohada.org/index.php/fr/actes-uniformes/135-aupcap',
      downloadUrl: 'https://www.ohada.org/wp-content/uploads/2023/01/AUPCAP-2015.pdf',
      bindingLanguage: 'fr',
      consolidated: true,
      adoptionDate: '2015-09-10',
      effectiveDate: '2015-12-24',
      versionLabel: 'Révision 2015',
      mimeType: 'application/pdf',
      residency: 'ohada',
    },
    {
      title: 'Acte uniforme portant organisation des sûretés (AUS)',
      jurisdiction: 'OHADA',
      sourceType: 'statute',
      publisher: 'OHADA',
      canonicalUrl: 'https://www.ohada.org/index.php/fr/actes-uniformes/128-aus',
      downloadUrl: 'https://www.ohada.org/wp-content/uploads/2023/01/AUS-2010.pdf',
      bindingLanguage: 'fr',
      consolidated: true,
      adoptionDate: '2010-12-15',
      effectiveDate: '2011-05-16',
      versionLabel: 'Révision 2010',
      mimeType: 'application/pdf',
      residency: 'ohada',
    },
  ];

  const euRegulations: NormalizedDocument[] = [
    {
      title: 'Règlement (UE) n° 1215/2012 — Bruxelles I bis',
      jurisdiction: 'EU',
      sourceType: 'regulation',
      publisher: 'EUR-Lex',
      canonicalUrl: 'https://eur-lex.europa.eu/eli/reg/2012/1215/oj',
      downloadUrl: 'https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=CELEX:32012R1215',
      bindingLanguage: 'fr',
      consolidated: true,
      adoptionDate: '2012-12-12',
      effectiveDate: '2015-01-10',
      versionLabel: 'Texte intégral JOUE',
      mimeType: 'application/pdf',
      residency: 'eu',
    },
    {
      title: 'Directive (UE) 2019/770 relative aux contenus et services numériques',
      jurisdiction: 'EU',
      sourceType: 'regulation',
      publisher: 'EUR-Lex',
      canonicalUrl: 'https://eur-lex.europa.eu/eli/dir/2019/770/oj',
      downloadUrl: 'https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=CELEX:32019L0770',
      bindingLanguage: 'fr',
      consolidated: false,
      adoptionDate: '2019-05-20',
      effectiveDate: '2019-06-11',
      versionLabel: 'Texte original',
      mimeType: 'application/pdf',
      residency: 'eu',
    },
  ];

  const franceCore: NormalizedDocument[] = [
    {
      title: 'Code civil - Article 1240',
      jurisdiction: 'FR',
      sourceType: 'statute',
      publisher: 'Légifrance',
      canonicalUrl: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902',
      downloadUrl: 'https://www.legifrance.gouv.fr/download_txt.do?cidTexte=LEGITEXT000006070721',
      bindingLanguage: 'fr',
      consolidated: true,
      effectiveDate: today,
      versionLabel: 'Consolidation courante',
      mimeType: 'text/plain',
      residency: 'eu',
    },
    {
      title: 'Cour de cassation, chambre sociale, 25 novembre 2015, n° 14-21.125',
      jurisdiction: 'FR',
      sourceType: 'case',
      publisher: 'Cour de cassation',
      canonicalUrl: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
      downloadUrl: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
      bindingLanguage: 'fr',
      consolidated: false,
      effectiveDate: '2015-11-25',
      versionLabel: 'Arrêt intégral',
      mimeType: 'text/html',
      residency: 'eu',
    },
  ];

  const belgiumCore: NormalizedDocument[] = [
    {
      title: 'Code de droit économique - Livre VI (pratiques du marché et protection du consommateur)',
      jurisdiction: 'BE',
      sourceType: 'statute',
      publisher: 'Service Public Fédéral Justice',
      canonicalUrl: 'https://www.ejustice.just.fgov.be/eli/loi/2013/02/28/2013009095/justel',
      downloadUrl: 'https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=2013022809&table_name=loi',
      bindingLanguage: 'fr',
      consolidated: true,
      versionLabel: 'Consolidation Justel',
      mimeType: 'text/html',
      residency: 'eu',
    },
    {
      title: 'Cour de cassation (Belgique) - Arrêt du 4 septembre 2020 (C.19.0375.F)',
      jurisdiction: 'BE',
      sourceType: 'case',
      publisher: 'Cour de cassation de Belgique',
      canonicalUrl: 'https://www.courdecassation.be/id/20200904C190375F',
      downloadUrl: 'https://www.courdecassation.be/id/20200904C190375F',
      bindingLanguage: 'fr',
      consolidated: false,
      effectiveDate: '2020-09-04',
      versionLabel: 'Arrêt complet',
      mimeType: 'text/html',
      residency: 'eu',
    },
  ];

  const luxembourgCore: NormalizedDocument[] = [
    {
      title: 'Code du travail luxembourgeois',
      jurisdiction: 'LU',
      sourceType: 'statute',
      publisher: 'Legilux',
      canonicalUrl: 'https://legilux.public.lu/eli/etat/leg/code/travail/20230605',
      downloadUrl: 'https://legilux.public.lu/eli/etat/leg/code/travail/20230605',
      bindingLanguage: 'fr',
      consolidated: true,
      versionLabel: 'Consolidation Legilux',
      mimeType: 'text/html',
      residency: 'eu',
    },
  ];

  const monacoCore: NormalizedDocument[] = [
    {
      title: 'Code civil monégasque – Article 1229',
      jurisdiction: 'MC',
      sourceType: 'statute',
      publisher: 'Gouvernement Princier de Monaco',
      canonicalUrl: 'https://legimonaco.mc/305/legismclois.nsf/CodeTextes/2.1.5.1.079',
      downloadUrl: 'https://legimonaco.mc/305/legismclois.nsf/CodeTextes/2.1.5.1.079',
      bindingLanguage: 'fr',
      consolidated: true,
      versionLabel: 'Consolidation LégiMonaco',
      mimeType: 'text/html',
      residency: 'eu',
    },
  ];

  const switzerlandCore: NormalizedDocument[] = [
    {
      title: 'Code des obligations suisse (CO)',
      jurisdiction: 'CH',
      sourceType: 'statute',
      publisher: 'Confédération suisse',
      canonicalUrl: 'https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr',
      downloadUrl: 'https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr',
      bindingLanguage: 'fr',
      consolidated: true,
      versionLabel: 'Fedlex consolidation',
      mimeType: 'text/html',
      residency: 'ch',
    },
    {
      title: 'Tribunal fédéral suisse - ATF 145 III 433',
      jurisdiction: 'CH',
      sourceType: 'case',
      publisher: 'Tribunal fédéral',
      canonicalUrl: 'https://www.bger.ch/ext/eurospider/live/fr/php/aza/http/index.php?highlight_docid=aza://aza://04-11-2019-4A_138-2019-fr',
      downloadUrl: 'https://www.bger.ch/ext/eurospider/live/fr/php/aza/http/index.php?highlight_docid=aza://aza://04-11-2019-4A_138-2019-fr',
      bindingLanguage: 'fr',
      consolidated: false,
      effectiveDate: '2019-11-04',
      versionLabel: 'Arrêt intégral TF',
      mimeType: 'text/html',
      residency: 'ch',
    },
  ];

  const quebecCore: NormalizedDocument[] = [
    {
      title: 'Code civil du Québec (C.c.Q.)',
      jurisdiction: 'CA-QC',
      sourceType: 'statute',
      publisher: 'LégisQuébec',
      canonicalUrl: 'https://legisquebec.gouv.qc.ca/fr/ShowDoc/cs/CCQ-1991',
      downloadUrl: 'https://legisquebec.gouv.qc.ca/fr/ShowDoc/cs/CCQ-1991',
      bindingLanguage: 'fr',
      consolidated: true,
      versionLabel: 'Consolidation officielle',
      mimeType: 'text/html',
      residency: 'ca',
    },
    {
      title: 'Cour d’appel du Québec – 2019 QCCA 373',
      jurisdiction: 'CA-QC',
      sourceType: 'case',
      publisher: 'CanLII',
      canonicalUrl: 'https://canlii.ca/t/hz3b8',
      downloadUrl: 'https://canlii.ca/t/hz3b8',
      bindingLanguage: 'fr',
      consolidated: false,
      effectiveDate: '2019-03-13',
      versionLabel: 'Texte intégral CanLII',
      mimeType: 'text/html',
      residency: 'ca',
    },
  ];

  const maghrebDocs: NormalizedDocument[] = [
    {
      title: 'Bulletin Officiel du Royaume du Maroc - édition de traduction officielle',
      jurisdiction: 'MA',
      sourceType: 'gazette',
      publisher: 'Secrétariat Général du Gouvernement',
      canonicalUrl: 'https://www.sgg.gov.ma/Portals/0/BO/2024/bo_7244_fr.pdf',
      downloadUrl: 'https://www.sgg.gov.ma/Portals/0/BO/2024/bo_7244_fr.pdf',
      bindingLanguage: 'fr',
      consolidated: false,
      languageNote: 'Traduction officielle en français – vérifier l’édition arabe pour force obligatoire.',
      versionLabel: 'Édition 7244',
      mimeType: 'application/pdf',
      residency: 'maghreb',
    },
    {
      title: 'Journal Officiel de la République Tunisienne (JORT) n° 37/2024',
      jurisdiction: 'TN',
      sourceType: 'gazette',
      publisher: 'Imprimerie Officielle de la République Tunisienne',
      canonicalUrl: 'https://www.iort.gov.tn/WD120AWP/WD120Awp.exe/CONNECT/SIGP',
      downloadUrl: 'https://www.iort.gov.tn/WD120AWP/WD120Awp.exe/CONNECT/SIGP',
      bindingLanguage: 'ar',
      consolidated: false,
      languageNote: 'Version arabe juridiquement contraignante; version française informative.',
      versionLabel: 'Édition 37/2024',
      mimeType: 'text/html',
      residency: 'maghreb',
    },
    {
      title: 'Journal officiel de la République Algérienne Démocratique et Populaire - 2024-03-20',
      jurisdiction: 'DZ',
      sourceType: 'gazette',
      publisher: 'Secrétariat Général du Gouvernement algérien',
      canonicalUrl: 'https://www.joradp.dz/FTP/JO-FRANCAIS/2024/F2024020.pdf',
      downloadUrl: 'https://www.joradp.dz/FTP/JO-FRANCAIS/2024/F2024020.pdf',
      bindingLanguage: 'ar',
      consolidated: false,
      languageNote: 'Seule la version arabe fait foi; cette version française est fournie pour référence.',
      versionLabel: 'JO n°20/2024',
      mimeType: 'application/pdf',
      residency: 'maghreb',
    },
  ];

  return [
    {
      id: 'ohada-uniform-acts',
      description: 'OHADA Uniform Acts baseline snapshot',
      async fetchDocuments() {
        const [remoteActs, ccja] = await Promise.all([
          fetchOhadaUniformActsRemote(),
          fetchCcjaDocuments(12),
        ]);
        const dataset = remoteActs.length > 0 ? remoteActs : [];
        return dedupeDocuments([...dataset, ...ccja, ...ohadaUniformActs]);
      },
    },
    {
      id: 'eu-eur-lex-core',
      description: 'EUR-Lex overlays for EU member jurisdictions',
      async fetchDocuments() {
        return euRegulations;
      },
    },
    {
      id: 'fr-legifrance-core',
      description: 'France statutes and jurisprudence',
      async fetchDocuments() {
        const feedDocs = await fetchLegifranceRssDocuments(8);
        if (feedDocs.length > 0) {
          return dedupeDocuments([...feedDocs, ...franceCore]);
        }
        return franceCore;
      },
    },
    {
      id: 'be-justel-core',
      description: 'Belgium codes and cassation decisions',
      async fetchDocuments() {
        const feedDocs = await fetchJustelRssDocuments(10);
        return dedupeDocuments([...feedDocs, ...belgiumCore]);
      },
    },
    {
      id: 'lu-legilux-core',
      description: 'Luxembourg consolidated labour code',
      async fetchDocuments() {
        const feedDocs = await fetchLegiluxRssDocuments(10);
        return dedupeDocuments([...feedDocs, ...luxembourgCore]);
      },
    },
    {
      id: 'mc-legimonaco-core',
      description: 'Monaco civil code extracts',
      async fetchDocuments() {
        return monacoCore;
      },
    },
    {
      id: 'ch-fedlex-core',
      description: 'Switzerland federal code and TF jurisprudence',
      async fetchDocuments() {
        const [fedlexDocs, tfDocs] = await Promise.all([
          fetchFedlexAtomDocuments(10),
          fetchTribunalFederalDocuments(10),
        ]);
        return dedupeDocuments([...fedlexDocs, ...tfDocs, ...switzerlandCore]);
      },
    },
    {
      id: 'qc-authorities-core',
      description: 'Québec statutes and CanLII jurisprudence',
      async fetchDocuments() {
        const [legisQuebec, canlii, justice, supreme] = await Promise.all([
          fetchLegisQuebecDocuments(10),
          fetchCanLiiDocuments(6),
          fetchJusticeLawsDocuments(6),
          fetchSupremeCourtDocuments(6),
        ]);
        return dedupeDocuments([...legisQuebec, ...canlii, ...justice, ...supreme, ...quebecCore]);
      },
    },
    {
      id: 'maghreb-gazettes',
      description: 'Maghreb gazettes with language caveats',
      async fetchDocuments() {
        const [morocco, tunisia, algeria] = await Promise.all([
          fetchGazettesAfricaDocuments('mar', 'MA', 'fr',
            'Traduction française – vérifier l’édition arabe pour force obligatoire.'),
          fetchGazettesAfricaDocuments('tun', 'TN', 'ar',
            'Version arabe juridiquement contraignante; version française informative.'),
          fetchGazettesAfricaDocuments('dza', 'DZ', 'ar',
            'Seule la version arabe fait foi; la traduction française est fournie à titre informatif.'),
        ]);
        return dedupeDocuments([...morocco, ...tunisia, ...algeria, ...maghrebDocs]);
      },
    },
    {
      id: 'rw-official-gazette',
      description: 'Rwanda Official Gazette and judiciary snapshots',
      async fetchDocuments() {
        const docs = await loadRwandaDocuments();
        if (docs.length === 0) {
          console.warn('No Rwanda documents retrieved');
        }
        return dedupeDocuments(docs);
      },
    },
  ];
}

async function ingestDocuments(
  adapter: Adapter,
  docs: NormalizedDocument[],
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  openaiApiKey?: string,
  vectorStoreId?: string,
): Promise<IngestionSummary> {
  let inserted = 0;
  let skipped = 0;
  let failures = 0;

  for (const doc of docs) {
    try {
      const host = extractHost(doc.canonicalUrl);
      if (!host) {
        await recordQuarantine(supabase, orgId, adapter.id, doc, 'invalid_url', { canonicalUrl: doc.canonicalUrl });
        failures += 1;
        continue;
      }

      if (!isHostAllowlisted(host)) {
        await recordQuarantine(supabase, orgId, adapter.id, doc, 'domain_not_allowlisted', { host });
        skipped += 1;
        continue;
      }

      const download = await downloadDocument(doc);
      const payload = download.payload;
      const checksum = await toHexSha256(payload);
      const etag = download.etag ?? doc.etag ?? null;
      const lastModifiedHeader = download.lastModified ?? doc.lastModified ?? null;
      const lastModifiedIso =
        lastModifiedHeader && !Number.isNaN(Date.parse(lastModifiedHeader))
          ? new Date(lastModifiedHeader).toISOString()
          : null;
      const residency = (doc.residency ?? resolveResidencyZone(doc.jurisdiction)).toLowerCase();
      const storagePath = `${orgId}/${residency}/${slugify(doc.title)}.${extensionForMime(doc.mimeType)}`;
      const eli = doc.eli ?? deriveEli(doc.canonicalUrl);
      const ecli = doc.ecli ?? deriveEcli(doc.canonicalUrl);
      const akomaPayload = doc.akomaNtoso ?? buildAkomaNtoso(doc, eli, ecli);

      const existingSource = await supabase
        .from('sources')
        .select('id, capture_sha256, http_etag, last_modified')
        .eq('org_id', orgId)
        .eq('source_url', doc.canonicalUrl)
        .maybeSingle();

      if (existingSource.error) {
        throw new Error(existingSource.error.message);
      }

      if (existingSource.data) {
        const sameHash = existingSource.data.capture_sha256 === checksum;
        const sameEtag = etag && existingSource.data.http_etag && existingSource.data.http_etag === etag;
        if (sameHash || sameEtag) {
          try {
            const nextEtag = etag ?? existingSource.data.http_etag ?? null;
            const nextLastModified = lastModifiedIso ?? existingSource.data.last_modified ?? null;
            await supabase
              .from('sources')
              .update({
                link_last_checked_at: new Date().toISOString(),
                link_last_status: 'ok',
                link_last_error: null,
                residency_zone: residency,
                http_etag: nextEtag,
                last_modified: nextLastModified,
              })
              .eq('id', existingSource.data.id);
          } catch (updateError) {
            console.warn('Unable to update existing source health status', updateError);
          }

          const host = extractHost(doc.canonicalUrl);
          if (host) {
            try {
              await supabase
                .from('authority_domains')
                .update({
                  last_ingested_at: new Date().toISOString(),
                  failure_count: 0,
                  last_failed_at: null,
                })
                .eq('host', host)
                .eq('jurisdiction_code', doc.jurisdiction);
            } catch (updateError) {
              console.warn('Unable to update authority domain health', updateError);
            }
          }

          skipped += 1;
          continue;
        }
      }

      const uploadResult = await supabase.storage
        .from('authorities')
        .upload(storagePath, payload, {
          contentType: doc.mimeType,
          upsert: true,
        });

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      const sourceInsert = await supabase
        .from('sources')
        .upsert(
          {
            org_id: orgId,
            jurisdiction_code: doc.jurisdiction,
            source_type: doc.sourceType,
            title: doc.title,
            publisher: doc.publisher,
            source_url: doc.canonicalUrl,
            binding_lang: doc.bindingLanguage,
            consolidated: doc.consolidated,
            adopted_date: doc.adoptionDate ?? null,
            effective_date: doc.effectiveDate ?? null,
            language_note: doc.languageNote ?? null,
            version_label: doc.versionLabel ?? null,
            capture_sha256: checksum,
            http_etag: etag,
            last_modified: lastModifiedIso,
            residency_zone: residency,
            link_last_checked_at: new Date().toISOString(),
            link_last_status: 'ok',
            link_last_error: null,
            eli,
            ecli,
            akoma_ntoso: akomaPayload,
          },
          { onConflict: 'org_id,source_url' },
        )
        .select('id')
        .single();

      if (sourceInsert.error || !sourceInsert.data) {
        throw new Error(sourceInsert.error?.message ?? 'Unable to persist source');
      }

      let openaiFileId: string | null = null;
      let vectorStoreStatus: 'pending' | 'uploaded' | 'failed' = 'pending';
      let vectorStoreError: string | null = null;
      let syncedAt: string | null = null;

      if (openaiApiKey && vectorStoreId) {
        try {
          const filename = `${slugify(doc.title)}.${extensionForMime(doc.mimeType)}`;
          openaiFileId = await uploadToVectorStore(vectorStoreId, openaiApiKey, payload, doc.mimeType, filename);
          vectorStoreStatus = 'uploaded';
          syncedAt = new Date().toISOString();
        } catch (error) {
          vectorStoreStatus = 'failed';
          vectorStoreError = error instanceof Error ? error.message : 'Unknown vector store error';
        }
      }

      const documentUpsert = await supabase
        .from('documents')
        .upsert(
          {
            org_id: orgId,
            source_id: sourceInsert.data.id,
            name: doc.title,
            storage_path: storagePath,
            bucket_id: 'authorities',
            openai_file_id: openaiFileId,
            mime_type: doc.mimeType,
            bytes: payload.byteLength,
            vector_store_status: vectorStoreStatus,
            vector_store_error: vectorStoreError,
            vector_store_synced_at: syncedAt,
            residency_zone: residency,
          },
          { onConflict: 'org_id,bucket_id,storage_path' },
        );

      if (documentUpsert.error) {
        throw new Error(documentUpsert.error.message);
      }

      if (host) {
        await supabase
          .from('authority_domains')
          .update({
            last_ingested_at: new Date().toISOString(),
            failure_count: 0,
            last_failed_at: null,
          })
          .eq('host', host)
          .eq('jurisdiction_code', doc.jurisdiction);
      }

      inserted += 1;
    } catch (error) {
      console.error(`Failed to ingest document for adapter ${adapter.id}:`, error);
      try {
        const failureMessage = error instanceof Error ? error.message : String(error);
        const host = extractHost(doc.canonicalUrl);
        if (host) {
          const domainLookup = await supabase
            .from('authority_domains')
            .select('id, failure_count')
            .eq('host', host)
            .eq('jurisdiction_code', doc.jurisdiction)
            .maybeSingle();

          if (!domainLookup.error && domainLookup.data) {
            await supabase
              .from('authority_domains')
              .update({
                last_failed_at: new Date().toISOString(),
                failure_count: (domainLookup.data.failure_count ?? 0) + 1,
              })
              .eq('id', domainLookup.data.id);
          }
        }

        const failureSource = await supabase
          .from('sources')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_url', doc.canonicalUrl)
          .maybeSingle();

        if (!failureSource.error && failureSource.data) {
          await supabase
            .from('sources')
            .update({
              link_last_checked_at: new Date().toISOString(),
              link_last_status: 'failed',
              link_last_error: failureMessage,
            })
            .eq('id', failureSource.data.id);
        }
      } catch (updateError) {
        console.warn('Unable to record link failure telemetry', updateError);
      }
      await recordQuarantine(
        supabase,
        orgId,
        adapter.id,
        doc,
        'ingestion_failure',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      failures += 1;
    }
  }

  return { adapterId: adapter.id, inserted, skipped, failures };
}

async function createIngestionRun(
  supabase: ReturnType<typeof createClient>,
  adapterId: string,
  orgId: string,
): Promise<IngestionRunRecord | null> {
  const { data, error } = await supabase
    .from('ingestion_runs')
    .insert({ adapter_id: adapterId, org_id: orgId, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error) {
    console.warn(`Unable to record ingestion start for ${adapterId}:`, error);
    return null;
  }

  return { id: data.id as string, adapterId };
}

async function finalizeIngestionRun(
  supabase: ReturnType<typeof createClient>,
  record: IngestionRunRecord | null,
  summary: IngestionSummary,
  status: 'completed' | 'failed',
  error?: string,
) {
  if (!record) {
    return;
  }

  const update = await supabase
    .from('ingestion_runs')
    .update({
      status,
      inserted_count: summary.inserted,
      skipped_count: summary.skipped,
      failed_count: summary.failures,
      finished_at: new Date().toISOString(),
      error_message: error ?? null,
    })
    .eq('id', record.id);

  if (update.error) {
    console.warn(`Unable to finalize ingestion run ${record.id}:`, update.error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const body = (await req.json().catch(() => ({}))) as CrawlRequestBody;
  const { supabaseUrl, supabaseServiceRole, orgId, openaiApiKey, vectorStoreId } = body;

  if (!supabaseUrl || !supabaseServiceRole || !orgId) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials or orgId' }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRole);
  const adapters = buildAdapters();
  const summaries: IngestionSummary[] = [];

  for (const adapter of adapters) {
    const runRecord = await createIngestionRun(supabase, adapter.id, orgId);
    try {
      const documents = await adapter.fetchDocuments();
      const summary = await ingestDocuments(adapter, documents, supabase, orgId, openaiApiKey, vectorStoreId);
      summaries.push(summary);
      await finalizeIngestionRun(supabase, runRecord, summary, 'completed');
    } catch (error) {
      console.error(`Adapter ${adapter.id} failed`, error);
      const summary = { adapterId: adapter.id, inserted: 0, skipped: 0, failures: 1 } satisfies IngestionSummary;
      summaries.push(summary);
      await finalizeIngestionRun(supabase, runRecord, summary, 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  return new Response(JSON.stringify({ summaries }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
