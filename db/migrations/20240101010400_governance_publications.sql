-- Governance publications for DPIA, Council of Europe commitments, etc.
CREATE TABLE IF NOT EXISTS public.governance_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  doc_url text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX if NOT EXISTS governance_publications_category_idx ON public.governance_publications (category);

CREATE INDEX if NOT EXISTS governance_publications_status_idx ON public.governance_publications (status);
