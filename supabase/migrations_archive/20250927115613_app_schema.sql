-- Application schema for the francophone lawyer AI agent.
-- Creates core domain tables plus sensible defaults and row-level security policies.
-- Ensure required extensions exist.
CREATE EXTENSION if NOT EXISTS "vector"
WITH
  schema extensions;

-- Helper function to keep updated_at columns current.
CREATE OR REPLACE FUNCTION public.set_updated_at () returns trigger language plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Custom enumerations -------------------------------------------------------
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

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id uuid,
ADD COLUMN IF NOT EXISTS preferred_language text,
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS organisation text,
ADD COLUMN IF NOT EXISTS timezone text,
ADD COLUMN IF NOT EXISTS metadata jsonb,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone_e164 text,
ADD COLUMN IF NOT EXISTS professional_type text,
ADD COLUMN IF NOT EXISTS bar_number text,
ADD COLUMN IF NOT EXISTS court_id text,
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET
  id = user_id
WHERE
  id IS NULL;

UPDATE public.profiles
SET
  preferred_language = coalesce(preferred_language, locale, 'fr');

UPDATE public.profiles
SET ROLE = coalesce(role, 'client');

UPDATE public.profiles
SET
  timezone = coalesce(timezone, 'Europe/Paris');

UPDATE public.profiles
SET
  metadata = '{}'::jsonb
WHERE
  metadata IS NULL;

UPDATE public.profiles
SET
  verified = FALSE
WHERE
  verified IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN id
SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN preferred_language
SET DEFAULT 'fr';

ALTER TABLE public.profiles
ALTER COLUMN role
SET DEFAULT 'client';

ALTER TABLE public.profiles
ALTER COLUMN timezone
SET DEFAULT 'Europe/Paris';

ALTER TABLE public.profiles
ALTER COLUMN metadata
SET DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
ALTER COLUMN preferred_language
SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN role
SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN timezone
SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN metadata
SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN verified
SET DEFAULT FALSE;

ALTER TABLE public.profiles
ALTER COLUMN verified
SET NOT NULL;

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

DO $$
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

DROP TRIGGER if EXISTS set_profiles_updated_at ON public.profiles;

CREATE TRIGGER set_profiles_updated_at before
UPDATE ON public.profiles FOR each ROW
EXECUTE procedure public.set_updated_at ();

-- Cases ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  status public.case_status NOT NULL DEFAULT 'draft',
  jurisdiction text,
  matter_type text,
  tags TEXT[] DEFAULT '{}',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS cases_owner_idx ON public.cases (owner_id);

CREATE INDEX if NOT EXISTS cases_status_idx ON public.cases (status);

DROP TRIGGER if EXISTS set_cases_updated_at ON public.cases;

CREATE TRIGGER set_cases_updated_at before
UPDATE ON public.cases FOR each ROW
EXECUTE procedure public.set_updated_at ();

-- Documents -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text,
  language text DEFAULT 'fr',
  storage_path text,
  content_preview text,
  embedding vector (1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_documents_case_idx ON public.case_documents (case_id);

CREATE INDEX if NOT EXISTS case_documents_language_idx ON public.case_documents (language);

DROP TRIGGER if EXISTS set_case_documents_updated_at ON public.case_documents;

CREATE TRIGGER set_case_documents_updated_at before
UPDATE ON public.case_documents FOR each ROW
EXECUTE procedure public.set_updated_at ();

-- Messages ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  actor public.message_actor NOT NULL,
  sender_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  content text NOT NULL,
  tokens int CHECK (tokens >= 0),
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_messages_case_idx ON public.case_messages (case_id, created_at);

-- Task tracking -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'todo' CHECK (
    status IN ('todo', 'in_progress', 'blocked', 'done')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS tasks_case_idx ON public.tasks (case_id);

CREATE INDEX if NOT EXISTS tasks_owner_idx ON public.tasks (owner_id);

DROP TRIGGER if EXISTS set_tasks_updated_at ON public.tasks;

CREATE TRIGGER set_tasks_updated_at before
UPDATE ON public.tasks FOR each ROW
EXECUTE procedure public.set_updated_at ();

-- Row-Level Security --------------------------------------------------------
ALTER TABLE public.profiles enable ROW level security;

ALTER TABLE public.cases enable ROW level security;

ALTER TABLE public.case_documents enable ROW level security;

ALTER TABLE public.case_messages enable ROW level security;

ALTER TABLE public.tasks enable ROW level security;

DROP POLICY if EXISTS "Profiles are accessible by owner" ON public.profiles;

CREATE POLICY "Profiles are accessible by owner" ON public.profiles USING (id = auth.uid ())
WITH
  CHECK (id = auth.uid ());

-- Allow the authenticated user to create a profile matching their UID.
DROP POLICY if EXISTS "Insert own profile" ON public.profiles;

CREATE POLICY "Insert own profile" ON public.profiles FOR insert
WITH
  CHECK (id = auth.uid ());

-- Cases: owner-based access.
DROP POLICY if EXISTS "Cases visible to owner" ON public.cases;

CREATE POLICY "Cases visible to owner" ON public.cases FOR
SELECT
  USING (owner_id = auth.uid ());

DROP POLICY if EXISTS "Cases modifiable by owner" ON public.cases;

CREATE POLICY "Cases modifiable by owner" ON public.cases FOR ALL USING (owner_id = auth.uid ())
WITH
  CHECK (owner_id = auth.uid ());

-- Documents follow case ownership.
DROP POLICY if EXISTS "Documents follow case ownership" ON public.case_documents;

CREATE POLICY "Documents follow case ownership" ON public.case_documents USING (
  EXISTS (
    SELECT
      1
    FROM
      public.cases c
    WHERE
      c.id = case_documents.case_id
      AND c.owner_id = auth.uid ()
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.cases c
      WHERE
        c.id = case_documents.case_id
        AND c.owner_id = auth.uid ()
    )
  );

DROP POLICY if EXISTS "Messages follow case ownership" ON public.case_messages;

CREATE POLICY "Messages follow case ownership" ON public.case_messages USING (
  EXISTS (
    SELECT
      1
    FROM
      public.cases c
    WHERE
      c.id = case_messages.case_id
      AND c.owner_id = auth.uid ()
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.cases c
      WHERE
        c.id = case_messages.case_id
        AND c.owner_id = auth.uid ()
    )
  );

DROP POLICY if EXISTS "Tasks follow case ownership" ON public.tasks;

CREATE POLICY "Tasks follow case ownership" ON public.tasks USING (
  EXISTS (
    SELECT
      1
    FROM
      public.cases c
    WHERE
      c.id = tasks.case_id
      AND c.owner_id = auth.uid ()
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.cases c
      WHERE
        c.id = tasks.case_id
        AND c.owner_id = auth.uid ()
    )
  );

-- Default privileges & type grants -----------------------------------------
GRANT usage ON type public.case_status TO anon,
authenticated,
service_role;

GRANT usage ON type public.message_actor TO anon,
authenticated,
service_role;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT
SELECT
  ON tables TO anon;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT
SELECT
,
  insert,
UPDATE,
delete ON tables TO authenticated;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT usage,
SELECT
  ON sequences TO authenticated;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT ALL ON tables TO service_role;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT usage,
SELECT
  ON sequences TO service_role;
