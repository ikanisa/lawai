-- Create document summaries table and extend documents metadata for automated QA
create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  summary text,
  outline jsonb,
  created_at timestamptz not null default now(),
  constraint document_summaries_document_unique unique (document_id)
);

alter table public.documents
  add column if not exists summary_status text not null default 'pending',
  add column if not exists summary_generated_at timestamptz,
  add column if not exists summary_error text,
  add column if not exists chunk_count integer not null default 0;

alter table public.documents
  add constraint if not exists documents_summary_status_check
  check (summary_status in ('pending', 'ready', 'skipped', 'failed'));

alter table public.document_chunks
  add column if not exists article_or_section text;
