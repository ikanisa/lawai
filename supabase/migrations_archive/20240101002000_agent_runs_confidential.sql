alter table public.agent_runs
  add column if not exists confidential_mode boolean not null default false;

create index if not exists agent_runs_confidential_idx
  on public.agent_runs(confidential_mode);
