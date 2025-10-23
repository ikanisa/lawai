-- Store reviewer edit diagnostics for HITL resolutions
CREATE TABLE IF NOT EXISTS public.hitl_reviewer_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hitl_id uuid NOT NULL REFERENCES public.hitl_queue (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  reviewer_id uuid,
  action text NOT NULL,
  comment text,
  previous_payload jsonb,
  revised_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hitl_reviewer_edits enable ROW level security;

CREATE INDEX if NOT EXISTS hitl_reviewer_edits_hitl_idx ON public.hitl_reviewer_edits (hitl_id);

CREATE INDEX if NOT EXISTS hitl_reviewer_edits_run_idx ON public.hitl_reviewer_edits (run_id);

DROP POLICY if EXISTS "hitl reviewer edits by org" ON public.hitl_reviewer_edits;

CREATE POLICY "hitl reviewer edits by org" ON public.hitl_reviewer_edits FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
