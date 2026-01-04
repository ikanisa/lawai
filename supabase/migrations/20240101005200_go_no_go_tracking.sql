-- Go / No-Go checklist evidence and sign-off tracking
create table if not exists public.go_no_go_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  section text not null check (section in ('A','B','C','D','E','F','G','H')),
  criterion text not null,
  status text not null default 'pending' check (status in ('pending','satisfied')),
  evidence_url text,
  notes jsonb,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);

create index if not exists go_no_go_evidence_org_section_idx on public.go_no_go_evidence(org_id, section);

create table if not exists public.go_no_go_signoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  release_tag text not null,
  decision text not null check (decision in ('go','no-go')),
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  notes text,
  evidence_total int not null default 0
);

create unique index if not exists go_no_go_signoffs_org_release_idx on public.go_no_go_signoffs(org_id, release_tag);

alter table public.go_no_go_evidence enable row level security;
alter table public.go_no_go_signoffs enable row level security;

drop policy if exists "go_no_go_evidence_read" on public.go_no_go_evidence;
create policy "go_no_go_evidence_read" on public.go_no_go_evidence
  for select using (public.is_org_member(org_id));

drop policy if exists "go_no_go_evidence_write" on public.go_no_go_evidence;
create policy "go_no_go_evidence_write" on public.go_no_go_evidence
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "go_no_go_signoffs_read" on public.go_no_go_signoffs;
create policy "go_no_go_signoffs_read" on public.go_no_go_signoffs
  for select using (public.is_org_member(org_id));

drop policy if exists "go_no_go_signoffs_write" on public.go_no_go_signoffs;
create policy "go_no_go_signoffs_write" on public.go_no_go_signoffs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
