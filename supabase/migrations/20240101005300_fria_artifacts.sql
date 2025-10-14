-- FRIA artefact tracking and go/no-go enforcement
create table if not exists public.fria_artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  release_tag text,
  title text not null,
  evidence_url text,
  storage_path text,
  hash_sha256 text,
  validated boolean not null default false,
  submitted_by uuid not null,
  submitted_at timestamptz not null default now(),
  notes jsonb
);

create index if not exists fria_artifacts_org_idx on public.fria_artifacts(org_id);
create index if not exists fria_artifacts_org_release_idx on public.fria_artifacts(org_id, release_tag);

alter table public.fria_artifacts enable row level security;

drop policy if exists "fria_artifacts_read" on public.fria_artifacts;
create policy "fria_artifacts_read" on public.fria_artifacts
  for select using (public.is_org_member(org_id));

drop policy if exists "fria_artifacts_write" on public.fria_artifacts;
create policy "fria_artifacts_write" on public.fria_artifacts
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create unique index if not exists go_no_go_evidence_unique_idx
  on public.go_no_go_evidence(org_id, section, criterion);
