-- Track Google Drive manifest validations and watcher events
create table if not exists public.drive_manifests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  manifest_name text not null,
  manifest_url text,
  file_count integer not null default 0,
  valid_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  errors jsonb,
  warnings jsonb,
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.drive_manifest_items (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.drive_manifests(id) on delete cascade,
  file_id text not null,
  juris_code text not null,
  source_type text not null,
  source_url text not null,
  allowlisted boolean not null default false,
  binding_language text,
  effective_date date,
  consolidation_status text,
  validation_errors jsonb,
  validation_warnings jsonb
);

create index if not exists drive_manifest_items_manifest_idx
  on public.drive_manifest_items(manifest_id);
