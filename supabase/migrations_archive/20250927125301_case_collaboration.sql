-- Support collaborative case work with shared participants and helper functions.

-- Create collaborator role enum if missing.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'case_collaborator_role'
      and n.nspname = 'public'
  ) then
    create type public.case_collaborator_role as enum ('lawyer', 'client', 'assistant', 'observer');
  end if;
end;
$$;

-- Store collaborators explicitly.
create table if not exists public.case_collaborators (
  case_id uuid not null references public.cases(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.case_collaborator_role not null default 'client',
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (case_id, profile_id)
);

create index if not exists case_collaborators_profile_idx on public.case_collaborators(profile_id);

-- Helper to check if the current user owns the case.
create or replace function public.user_is_case_owner(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.cases c
    where c.id = p_case_id
      and c.owner_id = auth.uid()
  );
end;
$$;

-- Helper to determine whether a user can access a case (owner or collaborator).
create or replace function public.user_can_access_case(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.cases c
    where c.id = p_case_id
      and (c.owner_id = auth.uid()
           or exists (
             select 1
             from public.case_collaborators cc
             where cc.case_id = p_case_id
               and cc.profile_id = auth.uid()
           ))
  );
end;
$$;

-- Ensure every case owner also appears in the collaborator table.
create or replace function public.add_case_owner_collaborator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.case_collaborators (case_id, profile_id, role, added_by)
  values (new.id, new.owner_id, 'lawyer', new.owner_id)
  on conflict (case_id, profile_id) do update
    set role = excluded.role,
        added_by = excluded.added_by;

  return new;
end;
$$;

drop trigger if exists insert_case_owner_collaborator on public.cases;

create trigger insert_case_owner_collaborator
  after insert on public.cases
  for each row
  execute procedure public.add_case_owner_collaborator();

-- Backfill existing cases into collaborator table.
insert into public.case_collaborators (case_id, profile_id, role, added_by)
select c.id, c.owner_id, 'lawyer', c.owner_id
from public.cases c
on conflict (case_id, profile_id) do nothing;

-- Permissions for new enum type.
grant usage on type public.case_collaborator_role to anon, authenticated, service_role;

-- Enable RLS and policies for collaborators table.
alter table public.case_collaborators enable row level security;

drop policy if exists "Collaborators view" on public.case_collaborators;
drop policy if exists "Collaborators manage" on public.case_collaborators;

create policy "Collaborators view"
  on public.case_collaborators
  for select using (public.user_can_access_case(case_id));

create policy "Collaborators manage"
  on public.case_collaborators
  using (public.user_is_case_owner(case_id))
  with check (public.user_is_case_owner(case_id));

-- Refresh existing policies to rely on helper functions.
drop policy if exists "Cases visible to owner" on public.cases;
drop policy if exists "Cases visible to members" on public.cases;
drop policy if exists "Cases modifiable by owner" on public.cases;
drop policy if exists "Cases deletable by owner" on public.cases;
drop policy if exists "Cases owned by creator" on public.cases;

create policy "Cases visible to members"
  on public.cases
  for select using (public.user_can_access_case(id));

create policy "Cases owned by creator"
  on public.cases
  for insert
  with check (owner_id = auth.uid());

create policy "Cases modifiable by owner"
  on public.cases
  for update using (public.user_is_case_owner(id))
  with check (public.user_is_case_owner(id));

create policy "Cases deletable by owner"
  on public.cases
  for delete using (public.user_is_case_owner(id));

-- Documents policy refresh.
drop policy if exists "Documents follow case ownership" on public.case_documents;
drop policy if exists "Documents visible to members" on public.case_documents;
create policy "Documents visible to members"
  on public.case_documents
  using (public.user_can_access_case(case_id))
  with check (public.user_can_access_case(case_id));

-- Messages policy refresh.
drop policy if exists "Messages follow case ownership" on public.case_messages;
drop policy if exists "Messages visible to members" on public.case_messages;
create policy "Messages visible to members"
  on public.case_messages
  using (public.user_can_access_case(case_id))
  with check (public.user_can_access_case(case_id));

-- Tasks policy refresh.
drop policy if exists "Tasks follow case ownership" on public.tasks;
drop policy if exists "Tasks visible to members" on public.tasks;
create policy "Tasks visible to members"
  on public.tasks
  using (public.user_can_access_case(case_id))
  with check (public.user_can_access_case(case_id));
