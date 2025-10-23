-- FRIA artefact tracking and go/no-go enforcement
CREATE TABLE IF NOT EXISTS public.fria_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  release_tag text,
  title text NOT NULL,
  evidence_url text,
  storage_path text,
  hash_sha256 text,
  validated boolean NOT NULL DEFAULT FALSE,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  notes jsonb
);

CREATE INDEX if NOT EXISTS fria_artifacts_org_idx ON public.fria_artifacts (org_id);

CREATE INDEX if NOT EXISTS fria_artifacts_org_release_idx ON public.fria_artifacts (org_id, release_tag);

ALTER TABLE public.fria_artifacts enable ROW level security;

CREATE POLICY "fria_artifacts_read" ON public.fria_artifacts FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY "fria_artifacts_write" ON public.fria_artifacts FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE UNIQUE INDEX if NOT EXISTS go_no_go_evidence_unique_idx ON public.go_no_go_evidence (org_id, section, criterion);
