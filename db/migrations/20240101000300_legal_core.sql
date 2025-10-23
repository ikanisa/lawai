CREATE TABLE IF NOT EXISTS public.jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  eu boolean NOT NULL DEFAULT FALSE,
  ohada boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authority_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code text NOT NULL,
  host text NOT NULL,
  UNIQUE (jurisdiction_code, host)
);

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL,
  source_type text NOT NULL,
  title text NOT NULL,
  publisher text,
  source_url text NOT NULL,
  binding_lang text DEFAULT 'fr',
  consolidated boolean DEFAULT FALSE,
  adopted_date date,
  effective_date date,
  capture_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.sources (id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  openai_file_id text,
  mime_type text,
  bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL,
  content text NOT NULL,
  embedding vector (1536) NOT NULL,
  seq integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
