-- Export jobs and deletion requests with RLS

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null,
  format text not null check (format in ('csv','json')) default 'csv',
  status text not null check (status in ('pending','completed','failed')) default 'pending',
  file_path text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists export_jobs_org_idx on public.export_jobs(org_id, created_at desc);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null,
  target text not null check (target in ('document','source','org')),
  target_id uuid,
  reason text,
  status text not null check (status in ('pending','completed','failed')) default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index if not exists deletion_requests_org_idx on public.deletion_requests(org_id, created_at desc);

alter table public.export_jobs enable row level security;
alter table public.deletion_requests enable row level security;

drop policy if exists export_jobs_by_org on public.export_jobs;
create policy export_jobs_by_org on public.export_jobs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists deletion_requests_by_org on public.deletion_requests;
create policy deletion_requests_by_org on public.deletion_requests
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

