-- Align document chunk embeddings with 1536 dimension vectors
DO $$
declare
  current_dim integer;
begin
  select atttypmod
    into current_dim
  from pg_attribute
  where attrelid = 'public.document_chunks'::regclass
    and attname = 'embedding'
    and not attisdropped;

  if current_dim is not null and current_dim <> 1536 then
    execute 'drop index if exists document_chunks_embedding_idx';
    execute 'truncate table public.document_chunks';
    execute 'alter table public.document_chunks drop column embedding';
    execute 'alter table public.document_chunks add column embedding vector(1536)';
    execute 'alter table public.document_chunks alter column embedding set not null';
  end if;
end
$$;

CREATE INDEX if NOT EXISTS document_chunks_embedding_idx ON public.document_chunks USING hnsw (embedding vector_l2_ops);
