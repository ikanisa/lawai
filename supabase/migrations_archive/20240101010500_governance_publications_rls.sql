ALTER TABLE public.governance_publications enable ROW level security;

-- Publications are meant to be public; allow read access to all while
-- delegating write access to service role flows controlled by Supabase.
DROP POLICY if EXISTS "governance publications read" ON public.governance_publications;

CREATE POLICY "governance publications read" ON public.governance_publications FOR
SELECT
  USING (TRUE);

DROP POLICY if EXISTS "governance publications service write" ON public.governance_publications;

CREATE POLICY "governance publications service write" ON public.governance_publications FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');
