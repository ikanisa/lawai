-- Enhance documents metadata for vector store synchronisation
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS bucket_id text NOT NULL DEFAULT 'authorities',
ADD COLUMN IF NOT EXISTS vector_store_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS vector_store_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS vector_store_error text;

DO $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'vector_store_status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'documents_vector_store_status_check'
      and conrelid = 'public.documents'::regclass
  ) then
    execute $$alter table public.documents add constraint documents_vector_store_status_check
      check (vector_store_status in ('pending', 'uploaded', 'failed'))$$;
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name in ('org_id', 'bucket_id', 'storage_path')
  ) = 3 and not exists (
    select 1
    from pg_constraint
    where conname = 'documents_org_path_unique'
      and conrelid = 'public.documents'::regclass
  ) then
    execute $$alter table public.documents add constraint documents_org_path_unique
      unique (org_id, bucket_id, storage_path)$$;
  end if;
end
$do$;

DO $do$
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name in ('org_id', 'source_url')
  ) = 2 and not exists (
    select 1
    from pg_constraint
    where conname = 'sources_org_url_unique'
      and conrelid = 'public.sources'::regclass
  ) then
    execute $$alter table public.sources add constraint sources_org_url_unique
      unique (org_id, source_url)$$;
  end if;
end
$do$;
