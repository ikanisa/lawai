-- Agent learning, telemetry, and task orchestration tables
CREATE TABLE IF NOT EXISTS public.agent_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  version text,
  input_schema jsonb,
  output_schema jsonb,
  timeout_ms integer,
  max_retries integer,
  risk_level text,
  allow_domains TEXT[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS agent_tools_name_version_idx ON public.agent_tools (name, coalesce(version, ''));

CREATE TABLE IF NOT EXISTS public.agent_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL,
  term text NOT NULL,
  expansions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS agent_synonyms_juris_term_idx ON public.agent_synonyms (jurisdiction, term);

CREATE TABLE IF NOT EXISTS public.agent_learning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text
);

CREATE INDEX if NOT EXISTS agent_learning_jobs_status_idx ON public.agent_learning_jobs (status);

CREATE INDEX if NOT EXISTS agent_learning_jobs_org_idx ON public.agent_learning_jobs (org_id);

CREATE TABLE IF NOT EXISTS public.agent_task_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  payload jsonb,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);

CREATE INDEX if NOT EXISTS agent_task_queue_status_priority_idx ON public.agent_task_queue (status, priority DESC, created_at);

CREATE INDEX if NOT EXISTS agent_task_queue_org_idx ON public.agent_task_queue (org_id);

CREATE TABLE IF NOT EXISTS public.tool_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  latency_ms integer NOT NULL,
  success boolean NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS tool_telemetry_run_idx ON public.tool_telemetry (run_id);

CREATE INDEX if NOT EXISTS tool_telemetry_org_idx ON public.tool_telemetry (org_id);

ALTER TABLE public.agent_policy_versions enable ROW level security;

ALTER TABLE public.agent_tools enable ROW level security;

ALTER TABLE public.agent_synonyms enable ROW level security;

ALTER TABLE public.agent_learning_jobs enable ROW level security;

ALTER TABLE public.agent_task_queue enable ROW level security;

ALTER TABLE public.tool_telemetry enable ROW level security;

DROP POLICY if EXISTS agent_policy_versions_read ON public.agent_policy_versions;

CREATE POLICY agent_policy_versions_read ON public.agent_policy_versions FOR
SELECT
  USING (TRUE);

DROP POLICY if EXISTS agent_tools_read ON public.agent_tools;

CREATE POLICY agent_tools_read ON public.agent_tools FOR
SELECT
  USING (TRUE);

DROP POLICY if EXISTS agent_synonyms_read ON public.agent_synonyms;

CREATE POLICY agent_synonyms_read ON public.agent_synonyms FOR
SELECT
  USING (TRUE);

DROP POLICY if EXISTS agent_learning_jobs_policy ON public.agent_learning_jobs;

CREATE POLICY agent_learning_jobs_policy ON public.agent_learning_jobs FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS agent_task_queue_policy ON public.agent_task_queue;

CREATE POLICY agent_task_queue_policy ON public.agent_task_queue FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS tool_telemetry_policy ON public.tool_telemetry;

CREATE POLICY tool_telemetry_policy ON public.tool_telemetry FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
