-- Application schema for the francophone lawyer AI agent.
-- Creates core domain tables plus sensible defaults and row-level security policies.

-- Ensure required extensions exist.
create extension if not exists "vector" with schema extensions;

-- Helper function to keep updated_at columns current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'case_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.case_status AS ENUM ('draft', 'in_review', 'awaiting_client', 'closed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'message_actor'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.message_actor AS ENUM ('client', 'lawyer', 'assistant', 'system');
  END IF;
END
$$;

alter table public.profiles
  add column if not exists id uuid,
  add column if not exists preferred_language text,
  add column if not exists role text,
  add column if not exists organisation text,
  add column if not exists timezone text,
  add column if not exists metadata jsonb,
  add column if not exists email text,
  add column if not exists phone_e164 text,
  add column if not exists professional_type text,
  add column if not exists bar_number text,
  add column if not exists court_id text,
  add column if not exists verified boolean default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
  set id = user_id
  where id is null;

update public.profiles
  set preferred_language = coalesce(preferred_language, locale, 'fr');

update public.profiles
  set role = coalesce(role, 'client');

update public.profiles
  set timezone = coalesce(timezone, 'Europe/Paris');

update public.profiles
  set metadata = '{}'::jsonb
  where metadata is null;

update public.profiles
  set verified = false
  where verified is null;

alter table public.profiles
  alter column id set not null;

alter table public.profiles
  alter column preferred_language set default 'fr';

alter table public.profiles
  alter column role set default 'client';

alter table public.profiles
  alter column timezone set default 'Europe/Paris';

alter table public.profiles
  alter column metadata set default '{}'::jsonb;

alter table public.profiles
  alter column preferred_language set not null;

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  alter column timezone set not null;

alter table public.profiles
  alter column metadata set not null;

alter table public.profiles
  alter column verified set default false;

alter table public.profiles
  alter column verified set not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_key UNIQUE (id);
  END IF;
END
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'profiles'
      and c.conname = 'profiles_id_auth_fkey'
  ) then
    begin
      alter table public.profiles
        add constraint profiles_id_auth_fkey foreign key (id) references auth.users(id) on delete cascade;
    exception
      when others then
        raise notice 'Skipping auth.users FK for profiles.id: %', sqlerrm;
    end;
  end if;
end
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();

-- Cases ---------------------------------------------------------------------
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text,
  status public.case_status not null default 'draft',
  jurisdiction text,
  matter_type text,
  tags text[] default '{}',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_owner_idx on public.cases(owner_id);
create index if not exists cases_status_idx on public.cases(status);

drop trigger if exists set_cases_updated_at on public.cases;

create trigger set_cases_updated_at
  before update on public.cases
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  doc_type text,
  language text default 'fr',
  storage_path text,
  content_preview text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_documents_case_idx on public.case_documents(case_id);
create index if not exists case_documents_language_idx on public.case_documents(language);

drop trigger if exists set_case_documents_updated_at on public.case_documents;

create trigger set_case_documents_updated_at
  before update on public.case_documents
  for each row
  execute procedure public.set_updated_at();

-- Messages ------------------------------------------------------------------
create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  actor public.message_actor not null,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null,
  tokens int check (tokens >= 0),
  model text,
  created_at timestamptz not null default now()
);

create index if not exists case_messages_case_idx on public.case_messages(case_id, created_at);

-- Task tracking -------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_case_idx on public.tasks(case_id);
create index if not exists tasks_owner_idx on public.tasks(owner_id);

drop trigger if exists set_tasks_updated_at on public.tasks;

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row
  execute procedure public.set_updated_at();

-- Row-Level Security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_messages enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Profiles are accessible by owner" on public.profiles;
create policy "Profiles are accessible by owner"
  on public.profiles
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow the authenticated user to create a profile matching their UID.
drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile"
  on public.profiles
  for insert
  with check (id = auth.uid());

-- Cases: owner-based access.
drop policy if exists "Cases visible to owner" on public.cases;
create policy "Cases visible to owner"
  on public.cases
  for select using (owner_id = auth.uid());

drop policy if exists "Cases modifiable by owner" on public.cases;
create policy "Cases modifiable by owner"
  on public.cases
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Documents follow case ownership" on public.case_documents;
create policy "Documents follow case ownership"
  on public.case_documents
  using (exists (
    select 1 from public.cases c
    where c.id = case_documents.case_id
      and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_documents.case_id
      and c.owner_id = auth.uid()
  ));

drop policy if exists "Messages follow case ownership" on public.case_messages;
create policy "Messages follow case ownership"
  on public.case_messages
  using (exists (
    select 1 from public.cases c
    where c.id = case_messages.case_id
      and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_messages.case_id
      and c.owner_id = auth.uid()
  ));

drop policy if exists "Tasks follow case ownership" on public.tasks;
create policy "Tasks follow case ownership"
  on public.tasks
  using (exists (
    select 1 from public.cases c
    where c.id = tasks.case_id
      and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = tasks.case_id
      and c.owner_id = auth.uid()
  ));

-- Default privileges & type grants -----------------------------------------
grant usage on type public.case_status to anon, authenticated, service_role;
grant usage on type public.message_actor to anon, authenticated, service_role;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
