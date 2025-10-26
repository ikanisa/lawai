-- Admin panel foundational tables
CREATE TABLE IF NOT EXISTS public.admin_policies (
  org_id text NOT NULL,
  key text NOT NULL,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  PRIMARY KEY (org_id, key)
);

CREATE TABLE IF NOT EXISTS public.admin_entitlements (
  org_id text NOT NULL,
  jurisdiction text NOT NULL,
  entitlement text NOT NULL,
  enabled boolean NOT NULL DEFAULT FALSE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, jurisdiction, entitlement)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  object text NOT NULL,
  payload_before jsonb,
  payload_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb,
  actor text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_telemetry_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  metric text NOT NULL,
  value numeric,
  collected_at timestamptz NOT NULL DEFAULT now(),
  tags jsonb
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  invited_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz,
  UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS public.admin_agents (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL,
  tool_count integer NOT NULL DEFAULT 0,
  promoted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_workflows (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL,
  draft_diff jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.admin_hitl_queue (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  matter text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'pending',
  blast_radius integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_corpus_sources (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  label text NOT NULL,
  status text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  quarantine_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.admin_ingestion_tasks (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  stage text NOT NULL,
  status text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_evaluations (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  pass_rate numeric NOT NULL,
  slo_gate text NOT NULL,
  status text NOT NULL DEFAULT 'pass',
  last_run_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.admin_actor_org () returns text language sql stable AS $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'org_id', '');
$$;

ALTER TABLE public.admin_policies enable ROW level security;

ALTER TABLE public.admin_entitlements enable ROW level security;

ALTER TABLE public.admin_audit_events enable ROW level security;

ALTER TABLE public.admin_jobs enable ROW level security;

ALTER TABLE public.admin_telemetry_snapshots enable ROW level security;

ALTER TABLE public.admin_users enable ROW level security;

ALTER TABLE public.admin_agents enable ROW level security;

ALTER TABLE public.admin_workflows enable ROW level security;

ALTER TABLE public.admin_hitl_queue enable ROW level security;

ALTER TABLE public.admin_corpus_sources enable ROW level security;

ALTER TABLE public.admin_ingestion_tasks enable ROW level security;

ALTER TABLE public.admin_evaluations enable ROW level security;

CREATE POLICY if NOT EXISTS "org members read policies" ON public.admin_policies FOR
SELECT
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members write policies" ON public.admin_policies FOR insert
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members update policies" ON public.admin_policies
FOR UPDATE
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members read entitlements" ON public.admin_entitlements FOR
SELECT
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members write entitlements" ON public.admin_entitlements FOR insert
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members update entitlements" ON public.admin_entitlements
FOR UPDATE
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members read audits" ON public.admin_audit_events FOR
SELECT
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members insert audits" ON public.admin_audit_events FOR insert
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members read jobs" ON public.admin_jobs FOR
SELECT
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members insert jobs" ON public.admin_jobs FOR insert
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members update jobs" ON public.admin_jobs
FOR UPDATE
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members read telemetry" ON public.admin_telemetry_snapshots FOR
SELECT
  USING (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members insert telemetry" ON public.admin_telemetry_snapshots FOR insert
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage users" ON public.admin_users USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage agents" ON public.admin_agents USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage workflows" ON public.admin_workflows USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage hitl" ON public.admin_hitl_queue USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage corpus" ON public.admin_corpus_sources USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage ingestion" ON public.admin_ingestion_tasks USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE POLICY if NOT EXISTS "org members manage evaluations" ON public.admin_evaluations USING (admin_actor_org () = org_id)
WITH
  CHECK (admin_actor_org () = org_id);

CREATE OR REPLACE FUNCTION public.match_chunks (
  query_embedding vector (1536),
  match_threshold float
) returns TABLE (chunk_id uuid, score float) language sql stable AS $$
  select id, 1 - (embedding <=> query_embedding) as score
  from public.document_chunks
  where 1 - (embedding <=> query_embedding) >= match_threshold
  order by score desc
  limit 20;
$$;

CREATE OR REPLACE FUNCTION public.domain_in_allowlist (domain text) returns boolean language sql stable AS $$
  select exists(select 1 from public.corpus_allowlist where host = domain);
$$;
