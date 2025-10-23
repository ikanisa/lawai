import {
  LEGAL_DOCUMENT_SUMMARY_JSON_SCHEMA,
  SUMMARISATION_CLIENT_TAGS,
  getOpenAIClient,
  parseLegalDocumentSummaryPayload,
} from '@avocat-ai/shared';
import { env } from './config.js';

const textDecoder = new TextDecoder('utf-8', { fatal: false });

const DEFAULT_SUMMARISER_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_SUMMARY_CHARS = 12000;
const MAX_CHUNKS = 40;

export type TextChunk = { seq: number; content: string; marker: string | null };

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normaliseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractPlainText(payload: Uint8Array, mimeType: string): string {
  if (!payload || payload.byteLength === 0) {
    return '';
  }

  const raw = textDecoder.decode(payload);
  if (!raw) {
    return '';
  }

  if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
    return normaliseWhitespace(stripHtml(raw));
  }

  if (mimeType.includes('xml')) {
    return normaliseWhitespace(stripHtml(raw));
  }

  if (mimeType.startsWith('text/')) {
    return normaliseWhitespace(raw);
  }

  if (mimeType === 'application/pdf') {
    return '';
  }

  return normaliseWhitespace(raw);
}

function detectArticleLabel(text: string): string | null {
  const articleMatch = text.match(/\b(?:article|art\.)\s*[0-9A-Za-z-]+/i);
  if (articleMatch) {
    return articleMatch[0];
  }
  const sectionMatch = text.match(/\b(?:section|chapitre|titre)\s*[0-9A-Za-z-]+/i);
  return sectionMatch ? sectionMatch[0] : null;
}

export function chunkText(content: string, chunkSize = 1200, overlap = 200): TextChunk[] {
  const cleaned = normaliseWhitespace(content);
  if (!cleaned) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let index = 0;
  let seq = 0;

  while (index < cleaned.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(index + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      if (lastPeriod > index + chunkSize / 2) {
        end = lastPeriod + 1;
      }
    }

    const slice = cleaned.slice(index, end).trim();
    if (slice.length > 0) {
      chunks.push({ seq, content: slice, marker: detectArticleLabel(slice) });
      seq += 1;
    }

    if (end >= cleaned.length) {
      break;
    }

    const nextIndex = Math.max(end - overlap, 0);
    index = nextIndex > index ? nextIndex : end;
  }

  return chunks;
}

async function generateStructuredSummary(
  text: string,
  metadata: { title: string; jurisdiction: string; publisher: string | null },
  openaiApiKey: string,
  model: string,
  maxSummaryChars: number,
): Promise<{ summary: string; highlights: Array<{ heading: string; detail: string }> }> {
  const truncated = text.slice(0, maxSummaryChars);
  const openai = getOpenAIClient({ apiKey: openaiApiKey, ...SUMMARISATION_CLIENT_TAGS });

  let response;
  try {
    response = await openai.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                "Tu es un assistant juridique senior. Résume les documents officiels en français, en rappelant les points clefs, la portée juridique et les dates importantes.",
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Titre: ${metadata.title}\nJuridiction: ${metadata.jurisdiction}\nÉditeur: ${metadata.publisher ?? 'Inconnu'}\n\nTexte:\n${truncated}`,
            },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: LEGAL_DOCUMENT_SUMMARY_JSON_SCHEMA },
      max_output_tokens: 800,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synthèse indisponible';
    throw new Error(message);
  }

  const outputText = (response?.output_text ?? '').trim();
  if (!outputText) {
    throw new Error('Réponse vide du modèle de synthèse');
  }

  const parsed = parseLegalDocumentSummaryPayload(outputText);
  return { summary: parsed.summary, highlights: parsed.highlights };
}

async function generateEmbeddings(
  texts: string[],
  openaiApiKey: string,
  model: string,
  dimensions: number | undefined,
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 16;
  const openai = getOpenAIClient({ apiKey: openaiApiKey, ...SUMMARISATION_CLIENT_TAGS });

  for (let index = 0; index < texts.length; index += batchSize) {
    const slice = texts.slice(index, index + batchSize);
    try {
      const response = await openai.embeddings.create({
        model,
        input: slice,
        ...(dimensions ? { dimensions } : {}),
      });

      for (const entry of response.data ?? []) {
        if (Array.isArray(entry?.embedding)) {
          embeddings.push(entry.embedding as number[]);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de génération des embeddings';
      throw new Error(message);
    }
  }

  return embeddings;
}

export interface SummarisationMetadata {
  title: string;
  jurisdiction: string;
  publisher: string | null;
}

export interface SummarisationResult {
  status: 'ready' | 'skipped' | 'failed';
  summary?: string;
  highlights?: Array<{ heading: string; detail: string }>;
  chunks: TextChunk[];
  embeddings: number[][];
  error?: string;
}

export async function summariseDocumentFromPayload(params: {
  payload: Uint8Array;
  mimeType: string;
  metadata: SummarisationMetadata;
  openaiApiKey: string;
  summariserModel?: string;
  embeddingModel?: string;
  maxSummaryChars?: number;
}): Promise<SummarisationResult> {
  const {
    payload,
    mimeType,
    metadata,
    openaiApiKey,
    summariserModel,
    embeddingModel,
    maxSummaryChars,
  } = params;

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const plainText = extractPlainText(payload, mimeType);
  if (!plainText || plainText.length < 120) {
    return {
      status: 'skipped',
      chunks: [],
      embeddings: [],
      error: 'Texte exploitable indisponible',
    };
  }

  try {
    const summary = await generateStructuredSummary(
      plainText,
      metadata,
      openaiApiKey,
      summariserModel ?? env.SUMMARISER_MODEL ?? DEFAULT_SUMMARISER_MODEL,
      Math.min(maxSummaryChars ?? env.MAX_SUMMARY_CHARS ?? DEFAULT_MAX_SUMMARY_CHARS, DEFAULT_MAX_SUMMARY_CHARS),
    );

    const chunks = chunkText(plainText);
    const inputs = chunks.map((chunk) => chunk.content);
    const embeddings = inputs.length
      ? await generateEmbeddings(
          inputs,
          openaiApiKey,
          embeddingModel ?? env.EMBEDDING_MODEL,
          env.EMBEDDING_DIMENSION,
        )
      : [];

    return {
      status: 'ready',
      summary: summary.summary,
      highlights: summary.highlights,
      chunks,
      embeddings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synthèse ou embeddings indisponibles';
    return {
      status: 'failed',
      chunks: [],
      embeddings: [],
      error: message,
    };
  }
}
