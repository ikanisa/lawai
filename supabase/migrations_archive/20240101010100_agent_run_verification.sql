-- Track verification outcomes for each agent run
alter table public.agent_runs
  add column if not exists verification_status text default 'unchecked',
  add column if not exists verification_notes jsonb default '[]'::jsonb;
