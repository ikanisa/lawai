alter table if exists public.export_jobs
  add column if not exists signature_manifest jsonb,
  add column if not exists content_sha256 text;

create index if not exists export_jobs_sha_idx on public.export_jobs using hash (content_sha256);
