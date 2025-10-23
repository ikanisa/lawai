-- Drafting drafts metadata and persistence of clause comparisons/exports
CREATE TABLE IF NOT EXISTS public.drafting_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.pleading_templates (id) ON DELETE SET NULL,
  agent_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  prompt text NOT NULL,
  title text,
  jurisdiction_code text,
  matter_type text,
  citations jsonb,
  clause_comparisons jsonb,
  exports jsonb,
  content_sha256 text,
  signature_manifest jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS drafting_drafts_org_idx ON public.drafting_drafts (org_id, created_at DESC);

CREATE INDEX if NOT EXISTS drafting_drafts_document_idx ON public.drafting_drafts (document_id);
