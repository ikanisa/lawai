-- Provenance alerts daily cron (example)
-- NOTE: Replace https://example.com with your Edge host or set a database GUC:
--   alter database postgres set app.edge_base_url = 'https://<project-ref>.functions.supabase.co';
-- and adjust the HTTP target accordingly.

-- Ensure required extensions are available
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Helper to invoke the Edge function
create or replace function public.provenance_alerts_trigger() returns void
language sql
security definer
as $$
  select net.http_post(
    coalesce(current_setting('app.edge_base_url', true), 'https://example.com') || '/provenance-alerts',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json'),
    15000
  );
$$;

comment on function public.provenance_alerts_trigger() is 'Invokes the provenance-alerts edge function (configure app.edge_base_url).';

-- Schedule once daily at 07:00 UTC (created inactive by default)
select cron.schedule('provenance-alerts-daily', '0 7 * * *', $$select public.provenance_alerts_trigger();$$);
update cron.job set active = false where jobname = 'provenance-alerts-daily';

