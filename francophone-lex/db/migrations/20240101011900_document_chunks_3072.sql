-- Upgrade document chunk embeddings to 3072 dimensions
DO $$
DECLARE
  current_dim integer;
BEGIN
  SELECT atttypmod
    INTO current_dim
  FROM pg_attribute
  WHERE attrelid = 'public.document_chunks'::regclass
    AND attname = 'embedding'
    AND NOT attisdropped;

  IF current_dim IS NULL OR current_dim <> 3072 THEN
    EXECUTE 'DROP INDEX IF EXISTS document_chunks_embedding_idx';
    EXECUTE 'ALTER TABLE public.document_chunks DROP COLUMN embedding';
    EXECUTE 'ALTER TABLE public.document_chunks ADD COLUMN embedding vector(3072)';
    EXECUTE 'ALTER TABLE public.document_chunks ALTER COLUMN embedding SET NOT NULL';
  END IF;
END
$$;

DO $$
DECLARE
  embedding_dim integer;
BEGIN
  SELECT atttypmod
    INTO embedding_dim
  FROM pg_attribute
  WHERE attrelid = 'public.document_chunks'::regclass
    AND attname = 'embedding'
    AND NOT attisdropped;

  IF embedding_dim IS NULL THEN
    RAISE NOTICE 'Skipping index creation for document_chunks_embedding_idx: embedding column not found.';
  ELSIF embedding_dim > 2000 THEN
    RAISE NOTICE 'Skipping index creation for document_chunks_embedding_idx: % dimensions exceed local pgvector index limit.', embedding_dim;
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks USING hnsw (embedding vector_l2_ops)';
  END IF;
END
$$;
