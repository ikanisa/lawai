ALTER TABLE public.organizations enable ROW level security;

ALTER TABLE public.org_members enable ROW level security;

ALTER TABLE public.profiles enable ROW level security;

ALTER TABLE public.sources enable ROW level security;

ALTER TABLE public.documents enable ROW level security;

ALTER TABLE public.document_chunks enable ROW level security;

ALTER TABLE public.agent_runs enable ROW level security;

ALTER TABLE public.tool_invocations enable ROW level security;

ALTER TABLE public.run_citations enable ROW level security;

ALTER TABLE public.hitl_queue enable ROW level security;

ALTER TABLE public.eval_cases enable ROW level security;

ALTER TABLE public.eval_results enable ROW level security;

DROP POLICY if EXISTS "orgs readable to members" ON public.organizations;

CREATE POLICY "orgs readable to members" ON public.organizations FOR
SELECT
  USING (public.is_org_member (id));

DROP POLICY if EXISTS "org_members self-read" ON public.org_members;

CREATE POLICY "org_members self-read" ON public.org_members FOR
SELECT
  USING (auth.uid () = user_id);

DROP POLICY if EXISTS "sources by org" ON public.sources;

CREATE POLICY "sources by org" ON public.sources FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DO $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'org_id'
  ) then
    execute 'drop policy if exists "documents by org" on public.documents';
    execute 'create policy "documents by org" on public.documents for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))';
  end if;
end
$$;

DROP POLICY if EXISTS "chunks by org" ON public.document_chunks;

CREATE POLICY "chunks by org" ON public.document_chunks FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS "runs by org" ON public.agent_runs;

CREATE POLICY "runs by org" ON public.agent_runs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "tool invocations by run" ON public.tool_invocations;

CREATE POLICY "tool invocations by run" ON public.tool_invocations FOR
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

DROP POLICY if EXISTS "citations by run" ON public.run_citations;

CREATE POLICY "citations by run" ON public.run_citations FOR
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

DROP POLICY if EXISTS "hitl by org" ON public.hitl_queue;

CREATE POLICY "hitl by org" ON public.hitl_queue FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "evals by org" ON public.eval_cases;

CREATE POLICY "evals by org" ON public.eval_cases FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "eval results by case" ON public.eval_results;

CREATE POLICY "eval results by case" ON public.eval_results FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        public.eval_cases c
      WHERE
        c.id = case_id
        AND public.is_org_member (c.org_id)
    )
  );
