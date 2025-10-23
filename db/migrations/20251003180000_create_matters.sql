CREATE OR REPLACE FUNCTION public.set_updated_at () returns trigger language plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS public.matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  agent_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  primary_document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  jurisdiction_code text,
  procedure text,
  status text NOT NULL DEFAULT 'open',
  risk_level text,
  hitl_required boolean DEFAULT FALSE,
  filing_date date,
  decision_date date,
  structured_payload jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  residency_zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS matters_org_idx ON public.matters (org_id, created_at DESC);

CREATE INDEX if NOT EXISTS matters_status_idx ON public.matters (status);

CREATE TRIGGER set_matters_updated_at before
UPDATE ON public.matters FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.matter_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters (id) ON DELETE CASCADE,
  name text NOT NULL,
  due_at timestamptz NOT NULL,
  jurisdiction_code text,
  rule_reference text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS matter_deadlines_matter_idx ON public.matter_deadlines (matter_id, due_at);

CREATE TRIGGER set_matter_deadlines_updated_at before
UPDATE ON public.matter_deadlines FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.matter_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  role text,
  cite_check_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS matter_documents_unique ON public.matter_documents (matter_id, document_id);

CREATE TRIGGER set_matter_documents_updated_at before
UPDATE ON public.matter_documents FOR each ROW
EXECUTE procedure public.set_updated_at ();

ALTER TABLE public.matters enable ROW level security;

ALTER TABLE public.matter_deadlines enable ROW level security;

ALTER TABLE public.matter_documents enable ROW level security;

DROP POLICY if EXISTS matters_access ON public.matters;

CREATE POLICY matters_access ON public.matters FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS matter_deadlines_access ON public.matter_deadlines;

CREATE POLICY matter_deadlines_access ON public.matter_deadlines FOR ALL USING (
  EXISTS (
    SELECT
      1
    FROM
      public.matters m
    WHERE
      m.id = matter_id
      AND public.is_org_member (m.org_id)
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.matters m
      WHERE
        m.id = matter_id
        AND public.is_org_member (m.org_id)
    )
  );

DROP POLICY if EXISTS matter_documents_access ON public.matter_documents;

CREATE POLICY matter_documents_access ON public.matter_documents FOR ALL USING (
  EXISTS (
    SELECT
      1
    FROM
      public.matters m
    WHERE
      m.id = matter_id
      AND public.is_org_member (m.org_id)
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.matters m
      WHERE
        m.id = matter_id
        AND public.is_org_member (m.org_id)
    )
  );

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.matters TO authenticated;

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.matter_deadlines TO authenticated;

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.matter_documents TO authenticated;
