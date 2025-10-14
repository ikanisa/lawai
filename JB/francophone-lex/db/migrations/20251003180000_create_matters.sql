create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  primary_document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  jurisdiction_code text,
  procedure text,
  status text not null default 'open',
  risk_level text,
  hitl_required boolean default false,
  filing_date date,
  decision_date date,
  structured_payload jsonb,
  metadata jsonb not null default '{}'::jsonb,
  residency_zone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matters_org_idx on public.matters(org_id, created_at desc);
create index if not exists matters_status_idx on public.matters(status);

create trigger set_matters_updated_at
  before update on public.matters
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  name text not null,
  due_at timestamptz not null,
  jurisdiction_code text,
  rule_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matter_deadlines_matter_idx on public.matter_deadlines(matter_id, due_at);

create trigger set_matter_deadlines_updated_at
  before update on public.matter_deadlines
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.matter_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  role text,
  cite_check_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists matter_documents_unique on public.matter_documents(matter_id, document_id);

create trigger set_matter_documents_updated_at
  before update on public.matter_documents
  for each row
  execute procedure public.set_updated_at();

alter table public.matters enable row level security;
alter table public.matter_deadlines enable row level security;
alter table public.matter_documents enable row level security;

drop policy if exists matters_access on public.matters;
create policy matters_access on public.matters
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists matter_deadlines_access on public.matter_deadlines;
create policy matter_deadlines_access on public.matter_deadlines
  for all
  using (
    exists (
      select 1 from public.matters m
      where m.id = matter_id and public.is_org_member(m.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.matters m
      where m.id = matter_id and public.is_org_member(m.org_id)
    )
  );

drop policy if exists matter_documents_access on public.matter_documents;
create policy matter_documents_access on public.matter_documents
  for all
  using (
    exists (
      select 1 from public.matters m
      where m.id = matter_id and public.is_org_member(m.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.matters m
      where m.id = matter_id and public.is_org_member(m.org_id)
    )
  );

grant select, insert, update, delete on public.matters to authenticated;
grant select, insert, update, delete on public.matter_deadlines to authenticated;
grant select, insert, update, delete on public.matter_documents to authenticated;
