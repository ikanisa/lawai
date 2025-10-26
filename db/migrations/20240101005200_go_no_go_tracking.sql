-- Go / No-Go checklist evidence and sign-off tracking
CREATE TABLE IF NOT EXISTS public.go_no_go_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  section text NOT NULL CHECK (
    section IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  ),
  criterion text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'satisfied')),
  evidence_url text,
  notes jsonb,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS go_no_go_evidence_org_section_idx ON public.go_no_go_evidence (org_id, section);

CREATE TABLE IF NOT EXISTS public.go_no_go_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  release_tag text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('go', 'no-go')),
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  evidence_total int NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX if NOT EXISTS go_no_go_signoffs_org_release_idx ON public.go_no_go_signoffs (org_id, release_tag);

ALTER TABLE public.go_no_go_evidence enable ROW level security;

ALTER TABLE public.go_no_go_signoffs enable ROW level security;

CREATE POLICY "go_no_go_evidence_read" ON public.go_no_go_evidence FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY "go_no_go_evidence_write" ON public.go_no_go_evidence FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY "go_no_go_signoffs_read" ON public.go_no_go_signoffs FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY "go_no_go_signoffs_write" ON public.go_no_go_signoffs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
