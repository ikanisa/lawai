-- Support collaborative case work with shared participants and helper functions.
-- Create collaborator role enum if missing.
DO $$
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
CREATE TABLE IF NOT EXISTS public.case_collaborators (
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.case_collaborator_role NOT NULL DEFAULT 'client',
  added_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, profile_id)
);

CREATE INDEX if NOT EXISTS case_collaborators_profile_idx ON public.case_collaborators (profile_id);

-- Helper to check if the current user owns the case.
CREATE OR REPLACE FUNCTION public.user_is_case_owner (p_case_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public AS $$
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
CREATE OR REPLACE FUNCTION public.user_can_access_case (p_case_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public AS $$
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
CREATE OR REPLACE FUNCTION public.add_case_owner_collaborator () returns trigger language plpgsql security definer
SET
  search_path = public AS $$
begin
  insert into public.case_collaborators (case_id, profile_id, role, added_by)
  values (new.id, new.owner_id, 'lawyer', new.owner_id)
  on conflict (case_id, profile_id) do update
    set role = excluded.role,
        added_by = excluded.added_by;

  return new;
end;
$$;

DROP TRIGGER if EXISTS insert_case_owner_collaborator ON public.cases;

CREATE TRIGGER insert_case_owner_collaborator
AFTER insert ON public.cases FOR each ROW
EXECUTE procedure public.add_case_owner_collaborator ();

-- Backfill existing cases into collaborator table.
INSERT INTO
  public.case_collaborators (case_id, profile_id, role, added_by)
SELECT
  c.id,
  c.owner_id,
  'lawyer',
  c.owner_id
FROM
  public.cases c
ON CONFLICT (case_id, profile_id) DO NOTHING;

-- Permissions for new enum type.
GRANT usage ON type public.case_collaborator_role TO anon,
authenticated,
service_role;

-- Enable RLS and policies for collaborators table.
ALTER TABLE public.case_collaborators enable ROW level security;

DROP POLICY if EXISTS "Collaborators view" ON public.case_collaborators;

DROP POLICY if EXISTS "Collaborators manage" ON public.case_collaborators;

CREATE POLICY "Collaborators view" ON public.case_collaborators FOR
SELECT
  USING (public.user_can_access_case (case_id));

CREATE POLICY "Collaborators manage" ON public.case_collaborators USING (public.user_is_case_owner (case_id))
WITH
  CHECK (public.user_is_case_owner (case_id));

-- Refresh existing policies to rely on helper functions.
DROP POLICY if EXISTS "Cases visible to owner" ON public.cases;

DROP POLICY if EXISTS "Cases visible to members" ON public.cases;

DROP POLICY if EXISTS "Cases modifiable by owner" ON public.cases;

DROP POLICY if EXISTS "Cases deletable by owner" ON public.cases;

DROP POLICY if EXISTS "Cases owned by creator" ON public.cases;

CREATE POLICY "Cases visible to members" ON public.cases FOR
SELECT
  USING (public.user_can_access_case (id));

CREATE POLICY "Cases owned by creator" ON public.cases FOR insert
WITH
  CHECK (owner_id = auth.uid ());

CREATE POLICY "Cases modifiable by owner" ON public.cases
FOR UPDATE
  USING (public.user_is_case_owner (id))
WITH
  CHECK (public.user_is_case_owner (id));

CREATE POLICY "Cases deletable by owner" ON public.cases FOR delete USING (public.user_is_case_owner (id));

-- Documents policy refresh.
DROP POLICY if EXISTS "Documents follow case ownership" ON public.case_documents;

DROP POLICY if EXISTS "Documents visible to members" ON public.case_documents;

CREATE POLICY "Documents visible to members" ON public.case_documents USING (public.user_can_access_case (case_id))
WITH
  CHECK (public.user_can_access_case (case_id));

-- Messages policy refresh.
DROP POLICY if EXISTS "Messages follow case ownership" ON public.case_messages;

DROP POLICY if EXISTS "Messages visible to members" ON public.case_messages;

CREATE POLICY "Messages visible to members" ON public.case_messages USING (public.user_can_access_case (case_id))
WITH
  CHECK (public.user_can_access_case (case_id));

-- Tasks policy refresh.
DROP POLICY if EXISTS "Tasks follow case ownership" ON public.tasks;

DROP POLICY if EXISTS "Tasks visible to members" ON public.tasks;

CREATE POLICY "Tasks visible to members" ON public.tasks USING (public.user_can_access_case (case_id))
WITH
  CHECK (public.user_can_access_case (case_id));
