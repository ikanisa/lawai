#!/usr/bin/env node
import path from 'node:path';
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { ensureVectorStore } from './lib/vector-store.js';
import { chunkText, decodeBlob, embedTexts, type EmbeddingEnv } from './lib/embeddings.js';

interface PendingDocument {
  id: string;
  org_id: string;
  bucket_id: string;
  storage_path: string;
  mime_type: string | null;
  jurisdiction_code: string | null;
}

const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'EMBEDDING_MODEL']);
const supabase = createSupabaseService(env);
let vectorStoreId = process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID ?? '';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || process.env.VECTOR_STORE_DRY_RUN === '1';
const pollIntervalMs = Number.parseInt(process.env.VECTOR_STORE_POLL_INTERVAL_MS ?? '5000', 10);
const pollTimeoutMs = Number.parseInt(process.env.VECTOR_STORE_POLL_TIMEOUT_MS ?? String(5 * 60_000), 10);

async function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchVectorStoreFile(
  apiKey: string,
  storeId: string,
  fileId: string,
): Promise<{ status: string; last_error?: { message?: string } | null }> {
  const response = await fetch(`https://api.openai.com/v1/vector_stores/${storeId}/files/${fileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? `OpenAI API error ${response.status}`;
    throw new Error(message);
  }

  const status = (json?.status as string | undefined) ?? (json?.data?.status as string | undefined) ?? 'unknown';
  const lastError = json?.last_error ?? json?.data?.last_error ?? null;
  return { status, last_error: lastError };
}

type PollStatus = {
  attempt: number;
  elapsedMs: number;
  status: string;
  consecutiveErrors: number;
};

async function waitForVectorStoreReady(
  apiKey: string,
  storeId: string,
  fileId: string,
  onStatus?: (status: PollStatus) => void,
) {
  const start = Date.now();
  const interval = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 5000;
  const timeout = Number.isFinite(pollTimeoutMs) && pollTimeoutMs > 0 ? pollTimeoutMs : 300000;

  let attempt = 0;
  let consecutiveErrors = 0;

  while (Date.now() - start <= timeout) {
    attempt += 1;
    let status = 'unknown';
    try {
      const result = await fetchVectorStoreFile(apiKey, storeId, fileId);
      status = result.status ?? 'unknown';
      consecutiveErrors = 0;

      if (status === 'completed') {
        onStatus?.({ attempt, elapsedMs: Date.now() - start, status, consecutiveErrors });
        return;
      }
      if (status === 'failed') {
        const message = result.last_error?.message ?? 'File processing failed';
        throw new Error(message);
      }
    } catch (error) {
      consecutiveErrors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('vector_store_poll_error', { attempt, message });
      onStatus?.({ attempt, elapsedMs: Date.now() - start, status: 'error', consecutiveErrors });
      if (consecutiveErrors >= 3) {
        throw new Error(`Vector store polling failed after ${attempt} attempts: ${message}`);
      }
    }

    onStatus?.({ attempt, elapsedMs: Date.now() - start, status, consecutiveErrors });
    const backoffFactor = Math.min(1 + consecutiveErrors, 4);
    await wait(interval * backoffFactor);
  }

  throw new Error('Vector store processing timeout');
}

async function upsertLocalChunks(doc: PendingDocument, blob: Blob, embeddingEnv: EmbeddingEnv) {
  const text = await decodeBlob(blob);
  const chunks = chunkText(text);

  await supabase.from('document_chunks').delete().eq('document_id', doc.id);

  if (chunks.length === 0) {
    return;
  }

  const embeddings = await embedTexts(
    chunks.map((chunk) => chunk.content),
    embeddingEnv,
  );

  const rows = chunks.map((chunk, index) => ({
    org_id: doc.org_id,
    document_id: doc.id,
    jurisdiction_code: doc.jurisdiction_code ?? 'UNK',
    content: chunk.content,
    embedding: embeddings[index],
    seq: chunk.seq,
  }));

  const { error } = await supabase.from('document_chunks').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

async function uploadDocument(
  doc: PendingDocument,
  apiKey: string,
  onStatus?: (status: PollStatus) => void,
) {
  const download = await supabase.storage.from(doc.bucket_id).download(doc.storage_path);
  if (download.error) {
    throw new Error(download.error.message);
  }

  const blob = download.data;
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const fileForm = new FormData();
  fileForm.append('purpose', 'assistants');
  const filename = path.basename(doc.storage_path) || `document-${doc.id}.bin`;
  fileForm.append('file', new Blob([buffer], { type: doc.mime_type ?? 'application/octet-stream' }), filename);

  const fileResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fileForm,
  });

  const fileJson = await fileResponse.json();
  if (!fileResponse.ok) {
    throw new Error(fileJson.error?.message ?? 'Erreur lors de l’upload du fichier vers OpenAI');
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
    throw new Error(attachJson.error?.message ?? 'Erreur lors du rattachement du fichier');
  }

  await supabase
    .from('documents')
    .update({
      openai_file_id: fileJson.id as string,
      vector_store_status: 'processing',
      vector_store_error: null,
      vector_store_synced_at: null,
    })
    .eq('id', doc.id);

  const vectorFileId = (attachJson?.id as string | undefined) ?? (attachJson?.data?.id as string | undefined) ?? (fileJson.id as string);

  await waitForVectorStoreReady(apiKey, vectorStoreId, vectorFileId, onStatus);

  await upsertLocalChunks(doc, blob, {
    OPENAI_API_KEY: apiKey,
    EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  });

  await supabase
    .from('documents')
    .update({
      vector_store_status: 'uploaded',
      vector_store_error: null,
      vector_store_synced_at: new Date().toISOString(),
    })
    .eq('id', doc.id);
}

async function markFailure(docId: string, message: string) {
  await supabase
    .from('documents')
    .update({ vector_store_status: 'failed', vector_store_error: message })
    .eq('id', docId);
}

async function main() {
  if (dryRun) {
    console.log('Mode simulation activé : aucune synchronisation OpenAI ne sera effectuée.');
    if (!vectorStoreId) {
      console.log('Aucun identifiant de vector store fourni (simulé).');
    }
  } else {
    vectorStoreId = await ensureVectorStore(env.OPENAI_API_KEY, vectorStoreId);
  }
  const spinner = ora('Recherche des documents en attente...').start();

  const pending = await supabase
    .from('documents')
    .select('id, org_id, bucket_id, storage_path, mime_type, source:source_id ( jurisdiction_code )')
    .eq('vector_store_status', 'pending')
    .limit(20);

  if (pending.error) {
    spinner.fail(`Impossible de lister les documents: ${pending.error.message}`);
    process.exit(1);
  }

  const documents = (pending.data ?? []).map((doc) => ({
    id: doc.id as string,
    org_id: doc.org_id as string,
    bucket_id: doc.bucket_id as string,
    storage_path: doc.storage_path as string,
    mime_type: (doc.mime_type as string | null) ?? null,
    jurisdiction_code:
      (doc.source && 'jurisdiction_code' in doc.source ? (doc.source.jurisdiction_code as string | null) : null) ?? null,
  })) as PendingDocument[];

  if (documents.length === 0) {
    spinner.succeed('Aucun document en attente de synchronisation.');
    return;
  }

  const storeLabel = vectorStoreId || (dryRun ? 'simulé' : 'inconnu');
  spinner.succeed(`${documents.length} document(s) à synchroniser avec le vector store ${storeLabel}.`);

  for (const doc of documents) {
    const docSpinner = ora(`Upload ${doc.storage_path}...`).start();
    try {
      if (dryRun) {
        docSpinner.succeed(`Simulation: ${doc.storage_path}`);
        continue;
      }
      await uploadDocument(doc, env.OPENAI_API_KEY, (info) => {
        if (info.status === 'error') {
          docSpinner.text = `Upload ${doc.storage_path}… erreur réseau (tentative ${info.attempt})`;
        } else if (info.status !== 'completed') {
          const seconds = Math.round(info.elapsedMs / 1000);
          docSpinner.text = `Upload ${doc.storage_path}… en traitement (${info.status}, ${seconds}s)`;
        }
      });
      docSpinner.succeed(`Synchronisé: ${doc.storage_path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      docSpinner.fail(`Échec: ${message}`);
      await markFailure(doc.id, message);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
