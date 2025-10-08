alter table public.eval_results
  add column if not exists metrics jsonb,
  add column if not exists citation_precision numeric,
  add column if not exists temporal_validity numeric,
  add column if not exists binding_warnings integer;

create index if not exists eval_results_case_idx
  on public.eval_results(case_id, created_at desc);
