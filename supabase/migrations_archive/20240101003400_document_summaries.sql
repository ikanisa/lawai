-- Create document summaries table and extend documents metadata for automated QA
CREATE TABLE IF NOT EXISTS public.document_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  summary text,
  outline jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_summaries_document_unique UNIQUE (document_id)
);

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS summary_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS summary_generated_at timestamptz,
ADD COLUMN IF NOT EXISTS summary_error text,
ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0;

DO $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'summary_status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'documents_summary_status_check'
      and conrelid = 'public.documents'::regclass
  ) then
    execute $$alter table public.documents add constraint documents_summary_status_check
      check (summary_status in ('pending', 'ready', 'skipped', 'failed'))$$;
  end if;
end
$do$;

ALTER TABLE public.document_chunks
ADD COLUMN IF NOT EXISTS article_or_section text;
