-- Track PDF upload ingestion jobs and guardrail metadata
create table if not exists public.upload_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  submitted_by uuid references public.profiles(user_id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'quarantined')),
  hash_sha256 text,
  confidentiality text not null default 'internal',
  guardrail_tags text[] not null default array[]::text[],
  metadata jsonb,
  quarantine_reason text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, document_id)
);

create index if not exists upload_ingestion_jobs_status_idx on public.upload_ingestion_jobs(status);
create index if not exists upload_ingestion_jobs_org_idx on public.upload_ingestion_jobs(org_id);
