CREATE TABLE IF NOT EXISTS public.learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_id uuid,
  source text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS idx_learning_signals_created_at ON public.learning_signals (created_at DESC);

CREATE INDEX if NOT EXISTS idx_learning_signals_org ON public.learning_signals (org_id, created_at DESC);

ALTER TABLE public.learning_signals enable ROW level security;

DROP POLICY if EXISTS "learning_signals_policy" ON public.learning_signals;

CREATE POLICY "learning_signals_policy" ON public.learning_signals FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE TABLE IF NOT EXISTS public.learning_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "window" text NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL,
  dims jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS idx_learning_metrics_metric ON public.learning_metrics (metric, computed_at DESC);

ALTER TABLE public.learning_metrics enable ROW level security;

DROP POLICY if EXISTS "learning_metrics_select" ON public.learning_metrics;

DROP POLICY if EXISTS "learning_metrics_write" ON public.learning_metrics;

CREATE POLICY "learning_metrics_select" ON public.learning_metrics FOR
SELECT
  USING (TRUE);

CREATE POLICY "learning_metrics_service" ON public.learning_metrics FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');

CREATE TABLE IF NOT EXISTS public.query_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  juris_code text,
  topic text,
  hint_type text NOT NULL,
  phrase text NOT NULL,
  weight double precision NOT NULL DEFAULT 1.0,
  policy_version_id uuid,
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS idx_query_hints_org ON public.query_hints (org_id, juris_code);

ALTER TABLE public.query_hints enable ROW level security;

DROP POLICY if EXISTS "query_hints_policy" ON public.query_hints;

CREATE POLICY "query_hints_policy" ON public.query_hints FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

CREATE TABLE IF NOT EXISTS public.citation_canonicalizer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text,
  pattern text NOT NULL,
  replacement text NOT NULL,
  policy_version_id uuid,
  activated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.citation_canonicalizer enable ROW level security;

DROP POLICY if EXISTS "citation_canonicalizer_select" ON public.citation_canonicalizer;

DROP POLICY if EXISTS "citation_canonicalizer_write" ON public.citation_canonicalizer;

CREATE POLICY "citation_canonicalizer_select" ON public.citation_canonicalizer FOR
SELECT
  USING (TRUE);

CREATE POLICY "citation_canonicalizer_service" ON public.citation_canonicalizer FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');

CREATE TABLE IF NOT EXISTS public.denylist_deboost (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  juris_code text,
  reason text NOT NULL,
  pattern text NOT NULL,
  action text NOT NULL CHECK (action IN ('deny', 'deboost')),
  weight double precision,
  policy_version_id uuid,
  activated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.denylist_deboost enable ROW level security;

DROP POLICY if EXISTS "denylist_deboost_policy" ON public.denylist_deboost;

CREATE POLICY "denylist_deboost_policy" ON public.denylist_deboost FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    (
      org_id IS NULL
      AND auth.role () = 'service_role'
    )
    OR public.is_org_member (org_id)
  );

CREATE INDEX if NOT EXISTS idx_denylist_deboost_org ON public.denylist_deboost (org_id, juris_code);
