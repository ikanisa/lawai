-- Enforce RLS for run_retrieval_sets
ALTER TABLE public.run_retrieval_sets enable ROW level security;

DROP POLICY if EXISTS "retrieval_sets_by_org" ON public.run_retrieval_sets;

CREATE POLICY "retrieval_sets_by_org" ON public.run_retrieval_sets FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "retrieval_sets_by_run" ON public.run_retrieval_sets;

CREATE POLICY "retrieval_sets_by_run" ON public.run_retrieval_sets FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        public.agent_runs r
      WHERE
        r.id = run_id
        AND public.is_org_member (r.org_id)
    )
  );
