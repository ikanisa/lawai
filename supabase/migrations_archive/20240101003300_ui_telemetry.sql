CREATE TABLE IF NOT EXISTS public.ui_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS ui_telemetry_org_idx ON public.ui_telemetry_events (org_id, created_at DESC);

CREATE INDEX if NOT EXISTS ui_telemetry_event_idx ON public.ui_telemetry_events (event_name, created_at DESC);

ALTER TABLE public.ui_telemetry_events enable ROW level security;

DROP POLICY if EXISTS ui_telemetry_read ON public.ui_telemetry_events;

CREATE POLICY ui_telemetry_read ON public.ui_telemetry_events FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS ui_telemetry_insert ON public.ui_telemetry_events;

CREATE POLICY ui_telemetry_insert ON public.ui_telemetry_events FOR insert
WITH
  CHECK (public.is_org_member (org_id));
