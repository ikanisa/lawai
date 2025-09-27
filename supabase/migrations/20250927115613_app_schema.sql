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

-- Custom enumerations -------------------------------------------------------
create type public.case_status as enum ('draft', 'in_review', 'awaiting_client', 'closed');
create type public.message_actor as enum ('client', 'lawyer', 'assistant', 'system');

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_language text not null default 'fr',
  role text not null default 'client' check (role in ('client', 'lawyer', 'admin')),
  organisation text,
  timezone text default 'Europe/Paris',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index cases_owner_idx on public.cases(owner_id);
create index cases_status_idx on public.cases(status);

create trigger set_cases_updated_at
  before update on public.cases
  for each row
  execute procedure public.set_updated_at();

-- Documents -----------------------------------------------------------------
create table if not exists public.documents (
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

create index documents_case_idx on public.documents(case_id);
create index documents_language_idx on public.documents(language);

create trigger set_documents_updated_at
  before update on public.documents
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

create index case_messages_case_idx on public.case_messages(case_id, created_at);

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

create index tasks_case_idx on public.tasks(case_id);
create index tasks_owner_idx on public.tasks(owner_id);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row
  execute procedure public.set_updated_at();

-- Row-Level Security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.documents enable row level security;
alter table public.case_messages enable row level security;
alter table public.tasks enable row level security;

-- Allow a user to manage their own profile.
create policy "Profiles are accessible by owner"
  on public.profiles
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow the authenticated user to create a profile matching their UID.
create policy "Insert own profile"
  on public.profiles
  for insert
  with check (id = auth.uid());

-- Cases: owner-based access.
create policy "Cases visible to owner"
  on public.cases
  for select using (owner_id = auth.uid());

create policy "Cases modifiable by owner"
  on public.cases
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Documents follow case ownership.
create policy "Documents follow case ownership"
  on public.documents
  using (exists (
    select 1 from public.cases c
    where c.id = documents.case_id
      and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = documents.case_id
      and c.owner_id = auth.uid()
  ));

-- Messages follow case ownership.
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

-- Tasks follow case ownership.
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
