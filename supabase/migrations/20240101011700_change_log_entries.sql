-- Product and operations change log entries
create table if not exists public.change_log_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entry_date date not null,
  title text not null,
  category text not null check (category in ('product','policy','ops','compliance','incident','release')),
  summary text,
  release_tag text,
  links jsonb,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);

create index if not exists change_log_entries_org_idx on public.change_log_entries(org_id, entry_date desc);
