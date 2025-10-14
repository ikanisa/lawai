-- Track ingestion runs and enable runtime activation toggles for authority domains
alter table public.authority_domains
  add column if not exists active boolean not null default true,
  add column if not exists last_ingested_at timestamptz;

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  adapter_id text not null,
  status text not null default 'pending',
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

create index if not exists ingestion_runs_adapter_idx on public.ingestion_runs(adapter_id, started_at desc);
