-- Track authoritative documents that were quarantined during ingestion
create table if not exists public.ingestion_quarantine (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  adapter_id text not null,
  source_url text not null,
  canonical_url text,
  reason text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, source_url, reason)
);

create index if not exists ingestion_quarantine_org_idx on public.ingestion_quarantine(org_id);
create index if not exists ingestion_quarantine_adapter_idx on public.ingestion_quarantine(adapter_id);
create index if not exists ingestion_quarantine_reason_idx on public.ingestion_quarantine(reason);
