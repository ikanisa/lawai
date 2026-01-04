-- Google Drive watch state per organization
create table if not exists public.gdrive_state (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  drive_id text,
  folder_id text,
  channel_id text,
  resource_id text,
  expiration timestamptz,
  start_page_token text,
  last_page_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gdrive_state enable row level security;

drop policy if exists "gdrive state by org" on public.gdrive_state;
create policy "gdrive state by org" on public.gdrive_state
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Trigger to update updated_at
create or replace function public.tg_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_gdrive_state on public.gdrive_state;
create trigger set_timestamp_gdrive_state
before update on public.gdrive_state
for each row execute function public.tg_set_timestamp();

