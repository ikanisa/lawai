-- Track remote HTTP metadata for change detection
alter table public.sources
  add column if not exists http_etag text,
  add column if not exists last_modified timestamptz;

alter table public.run_citations
  add column if not exists note text;
