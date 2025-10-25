CREATE TABLE IF NOT EXISTS public.orchestrator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  chat_session_id uuid REFERENCES public.chat_sessions (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  director_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  safety_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_objective text,
  last_director_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  last_safety_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX if NOT EXISTS orchestrator_sessions_org_idx ON public.orchestrator_sessions (org_id, created_at DESC);

CREATE INDEX if NOT EXISTS orchestrator_sessions_chat_idx ON public.orchestrator_sessions (chat_session_id);

CREATE TRIGGER set_orchestrator_sessions_updated_at before
UPDATE ON public.orchestrator_sessions FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.orchestrator_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.orchestrator_sessions (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  command_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued',
      'in_progress',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  priority integer NOT NULL DEFAULT 100,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  result jsonb,
  last_error text,
  notes jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS orchestrator_commands_org_status_idx ON public.orchestrator_commands (org_id, status, scheduled_for);

CREATE INDEX if NOT EXISTS orchestrator_commands_session_idx ON public.orchestrator_commands (session_id, scheduled_for);

CREATE TRIGGER set_orchestrator_commands_updated_at before
UPDATE ON public.orchestrator_commands FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.orchestrator_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  command_id uuid NOT NULL REFERENCES public.orchestrator_commands (id) ON DELETE CASCADE,
  worker text NOT NULL DEFAULT 'director' CHECK (worker IN ('director', 'safety', 'domain')),
  domain_agent text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS orchestrator_jobs_org_worker_idx ON public.orchestrator_jobs (org_id, worker, status, scheduled_at);

CREATE INDEX if NOT EXISTS orchestrator_jobs_command_idx ON public.orchestrator_jobs (command_id);

CREATE TRIGGER set_orchestrator_jobs_updated_at before
UPDATE ON public.orchestrator_jobs FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.org_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  connector_type text NOT NULL CHECK (
    connector_type IN (
      'erp',
      'tax',
      'accounting',
      'compliance',
      'analytics'
    )
  ),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (
    status IN ('inactive', 'pending', 'active', 'error')
  ),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets jsonb DEFAULT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS org_connectors_org_type_name_idx ON public.org_connectors (org_id, connector_type, name);

CREATE TRIGGER set_org_connectors_updated_at before
UPDATE ON public.org_connectors FOR each ROW
EXECUTE procedure public.set_updated_at ();

ALTER TABLE public.orchestrator_sessions enable ROW level security;

ALTER TABLE public.orchestrator_commands enable ROW level security;

ALTER TABLE public.orchestrator_jobs enable ROW level security;

ALTER TABLE public.org_connectors enable ROW level security;

DROP POLICY if EXISTS orchestrator_sessions_service_role ON public.orchestrator_sessions;

CREATE POLICY orchestrator_sessions_service_role ON public.orchestrator_sessions FOR ALL USING (auth.role () = 'service_role');

DROP POLICY if EXISTS orchestrator_sessions_org_access ON public.orchestrator_sessions;

CREATE POLICY orchestrator_sessions_org_access ON public.orchestrator_sessions FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS orchestrator_commands_service_role ON public.orchestrator_commands;

CREATE POLICY orchestrator_commands_service_role ON public.orchestrator_commands FOR ALL USING (auth.role () = 'service_role');

DROP POLICY if EXISTS orchestrator_commands_org_access ON public.orchestrator_commands;

CREATE POLICY orchestrator_commands_org_access ON public.orchestrator_commands FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS orchestrator_jobs_service_role ON public.orchestrator_jobs;

CREATE POLICY orchestrator_jobs_service_role ON public.orchestrator_jobs FOR ALL USING (auth.role () = 'service_role');

DROP POLICY if EXISTS orchestrator_jobs_org_access ON public.orchestrator_jobs;

CREATE POLICY orchestrator_jobs_org_access ON public.orchestrator_jobs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS org_connectors_service_role ON public.org_connectors;

CREATE POLICY org_connectors_service_role ON public.org_connectors FOR ALL USING (auth.role () = 'service_role');

DROP POLICY if EXISTS org_connectors_org_access ON public.org_connectors;

CREATE POLICY org_connectors_org_access ON public.org_connectors FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.orchestrator_sessions TO authenticated;

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.orchestrator_commands TO authenticated;

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.orchestrator_jobs TO authenticated;

GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.org_connectors TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_orchestrator_command (
  p_org_id uuid,
  p_session_id uuid,
  p_command_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL,
  p_priority integer DEFAULT 100,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_worker text DEFAULT 'director'
) returns uuid language plpgsql AS $$
declare
  v_session_id uuid := p_session_id;
  v_command_id uuid;
  v_worker text := coalesce(p_worker, 'director');
  v_schedule timestamptz := coalesce(p_scheduled_for, now());
begin
  if v_session_id is null then
    insert into public.orchestrator_sessions (org_id, created_by)
    values (p_org_id, p_created_by)
    returning id into v_session_id;
  end if;

  insert into public.orchestrator_commands (
    org_id,
    session_id,
    created_by,
    command_type,
    payload,
    priority,
    scheduled_for
  ) values (
    p_org_id,
    v_session_id,
    p_created_by,
    p_command_type,
    coalesce(p_payload, '{}'::jsonb),
    greatest(1, coalesce(p_priority, 100)),
    v_schedule
  ) returning id into v_command_id;

  insert into public.orchestrator_jobs (
    org_id,
    command_id,
    worker,
    status,
    scheduled_at
  ) values (
    p_org_id,
    v_command_id,
    v_worker,
    'pending',
    v_schedule
  );

  return v_command_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.register_org_connector (
  p_org_id uuid,
  p_connector_type text,
  p_name text,
  p_config jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'pending',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL
) returns uuid language plpgsql AS $$
declare
  v_id uuid;
begin
  insert into public.org_connectors (
    org_id,
    connector_type,
    name,
    config,
    status,
    metadata,
    created_by
  ) values (
    p_org_id,
    p_connector_type,
    p_name,
    coalesce(p_config, '{}'::jsonb),
    coalesce(p_status, 'pending'),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  on conflict (org_id, connector_type, name)
  do update set
    config = excluded.config,
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment ON TABLE public.orchestrator_sessions IS 'State container for multi-agent orchestration sessions (Director + Safety).';

comment ON TABLE public.orchestrator_commands IS 'Commands queued by the Director for domain agents or safety reviews.';

comment ON TABLE public.orchestrator_jobs IS 'Asynchronous jobs spawned by orchestrator commands, consumed by workers (Director, Safety, domain agents).';

comment ON TABLE public.org_connectors IS 'External ERP/Tax/Accounting connectors registered per organisation for orchestrator use.';
