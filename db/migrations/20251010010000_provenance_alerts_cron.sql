-- Provenance alerts daily cron (example)
-- NOTE: Replace https://example.com with your Edge host or set a database GUC:
--   alter database postgres set app.edge_base_url = 'https://<project-ref>.functions.supabase.co';
-- and adjust the HTTP target accordingly.
-- Ensure required extensions are available
CREATE EXTENSION if NOT EXISTS pg_cron
WITH
  schema extensions;

CREATE EXTENSION if NOT EXISTS pg_net
WITH
  schema extensions;

-- Helper to invoke the Edge function
CREATE OR REPLACE FUNCTION public.provenance_alerts_trigger () returns void language sql security definer AS $$
  select net.http_post(
    coalesce(current_setting('app.edge_base_url', true), 'https://example.com') || '/provenance-alerts',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json'),
    15000
  );
$$;

comment ON function public.provenance_alerts_trigger () IS 'Invokes the provenance-alerts edge function (configure app.edge_base_url).';

-- Schedule once daily at 07:00 UTC (created inactive by default)
SELECT
  cron.schedule (
    'provenance-alerts-daily',
    '0 7 * * *',
    $$select public.provenance_alerts_trigger();$$
  );

UPDATE cron.job
SET
  active = FALSE
WHERE
  jobname = 'provenance-alerts-daily';
