-- Case quality scoring and trust metadata
ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS trust_tier text CHECK (trust_tier IN ('T1', 'T2', 'T3', 'T4')) DEFAULT 'T1',
ADD COLUMN IF NOT EXISTS court_rank text,
ADD COLUMN IF NOT EXISTS court_identifier text,
ADD COLUMN IF NOT EXISTS political_risk_flag boolean DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS treatment_status text;

CREATE TABLE IF NOT EXISTS public.case_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources (id) ON DELETE CASCADE,
  juris_code text NOT NULL,
  score_overall numeric(5, 2) NOT NULL,
  axes jsonb NOT NULL,
  hard_block boolean NOT NULL DEFAULT FALSE,
  version integer NOT NULL DEFAULT 1,
  model_ref text,
  notes jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_scores_source_idx ON public.case_scores (source_id, computed_at DESC);

CREATE INDEX if NOT EXISTS case_scores_org_idx ON public.case_scores (org_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.case_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources (id) ON DELETE CASCADE,
  citing_source_id uuid REFERENCES public.sources (id) ON DELETE SET NULL,
  treatment text NOT NULL CHECK (
    treatment IN (
      'followed',
      'applied',
      'affirmed',
      'distinguished',
      'criticized',
      'negative',
      'overruled',
      'vacated',
      'pending_appeal',
      'questioned',
      'unknown'
    )
  ),
  court_rank text,
  weight numeric(4, 2) DEFAULT 1.0,
  decided_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_treatments_source_idx ON public.case_treatments (source_id);

CREATE INDEX if NOT EXISTS case_treatments_citing_idx ON public.case_treatments (citing_source_id);

CREATE TABLE IF NOT EXISTS public.case_statute_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  case_source_id uuid NOT NULL REFERENCES public.sources (id) ON DELETE CASCADE,
  statute_url text NOT NULL,
  article text,
  alignment_score numeric(5, 2),
  rationale_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_statute_links_case_idx ON public.case_statute_links (case_source_id);

CREATE TABLE IF NOT EXISTS public.risk_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  juris_code text NOT NULL,
  court_identifier text,
  period_from date,
  period_to date,
  risk_flag text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_score_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources (id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  new_score numeric(5, 2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS case_score_overrides_source_idx ON public.case_score_overrides (source_id, created_at DESC);
