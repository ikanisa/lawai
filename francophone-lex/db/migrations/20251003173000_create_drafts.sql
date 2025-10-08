create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  prompt text not null,
  status text not null default 'draft',
  jurisdiction_code text,
  matter_type text,
  body text not null,
  structured_payload jsonb not null,
  citations jsonb not null default '[]'::jsonb,
  clause_comparisons jsonb not null default '[]'::jsonb,
  exports jsonb not null default '[]'::jsonb,
  plan jsonb,
  trust_panel jsonb,
  verification jsonb,
  fill_ins jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  residency_zone text,
  content_sha256 text,
  signature_manifest jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drafts_org_idx on public.drafts(org_id, created_at desc);
create index if not exists drafts_document_idx on public.drafts(document_id);

create trigger set_drafts_updated_at
  before update on public.drafts
  for each row
  execute procedure public.set_updated_at();

alter table public.drafts enable row level security;

drop policy if exists drafts_access on public.drafts;
create policy drafts_access on public.drafts
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

grant select, insert, update, delete on public.drafts to authenticated;
