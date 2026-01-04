create table if not exists public.ui_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  event_name text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ui_telemetry_org_idx on public.ui_telemetry_events (org_id, created_at desc);
create index if not exists ui_telemetry_event_idx on public.ui_telemetry_events (event_name, created_at desc);

alter table public.ui_telemetry_events enable row level security;

drop policy if exists ui_telemetry_read on public.ui_telemetry_events;
create policy ui_telemetry_read on public.ui_telemetry_events
  for select
  using (public.is_org_member(org_id));

drop policy if exists ui_telemetry_insert on public.ui_telemetry_events;
create policy ui_telemetry_insert on public.ui_telemetry_events
  for insert
  with check (public.is_org_member(org_id));
