-- Enhance documents metadata for vector store synchronisation
alter table public.documents
  add column if not exists bucket_id text not null default 'authorities',
  add column if not exists vector_store_status text not null default 'pending',
  add column if not exists vector_store_synced_at timestamptz,
  add column if not exists vector_store_error text;

alter table public.documents
  add constraint if not exists documents_vector_store_status_check
  check (vector_store_status in ('pending', 'uploaded', 'failed'));

alter table public.documents
  add constraint if not exists documents_org_path_unique
  unique (org_id, bucket_id, storage_path);

alter table public.sources
  add constraint if not exists sources_org_url_unique
  unique (org_id, source_url);
