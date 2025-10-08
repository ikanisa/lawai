alter table if exists public.agent_runs
  add column if not exists agent_code text,
  add column if not exists agent_profile jsonb;

comment on column public.agent_runs.agent_code is 'Autonomous Suite manifest code used for this run.';
comment on column public.agent_runs.agent_profile is 'Serialized agent profile (key, code, label, tool allowlist, settings) used at execution time.';

create index if not exists agent_runs_agent_code_idx on public.agent_runs (agent_code);
