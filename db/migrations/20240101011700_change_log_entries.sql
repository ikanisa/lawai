-- Product and operations change log entries
CREATE TABLE IF NOT EXISTS public.change_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'product',
      'policy',
      'ops',
      'compliance',
      'incident',
      'release'
    )
  ),
  summary text,
  release_tag text,
  links jsonb,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS change_log_entries_org_idx ON public.change_log_entries (org_id, entry_date DESC);
