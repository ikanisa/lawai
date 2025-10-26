CREATE OR REPLACE FUNCTION public.set_updated_at () returns trigger language plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  agent_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  jurisdiction_code text,
  matter_type text,
  body text NOT NULL,
  structured_payload jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  clause_comparisons jsonb NOT NULL DEFAULT '[]'::jsonb,
  exports jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan jsonb,
  trust_panel jsonb,
  verification jsonb,
  fill_ins jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  residency_zone text,
  content_sha256 text,
  signature_manifest jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS drafts_org_idx ON public.drafts (org_id, created_at DESC);

CREATE INDEX if NOT EXISTS drafts_document_idx ON public.drafts (document_id);

CREATE TRIGGER set_drafts_updated_at before
UPDATE ON public.drafts FOR each ROW
EXECUTE procedure public.set_updated_at ();

ALTER TABLE public.drafts enable ROW level security;

DROP POLICY if EXISTS drafts_access ON public.drafts;

CREATE POLICY drafts_access ON public.drafts FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.drafts TO authenticated;
