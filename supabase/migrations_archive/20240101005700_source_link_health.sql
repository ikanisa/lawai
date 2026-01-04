-- Add link health tracking and residency metadata to authoritative sources
alter table public.sources
  add column if not exists link_last_checked_at timestamptz,
  add column if not exists link_last_status text check (link_last_status in ('ok', 'failed', 'stale')),
  add column if not exists link_last_error text,
  add column if not exists residency_zone text;

create index if not exists sources_link_status_idx on public.sources(link_last_status);
create index if not exists sources_residency_idx on public.sources(residency_zone);

alter table public.authority_domains
  add column if not exists last_failed_at timestamptz,
  add column if not exists failure_count integer not null default 0;
