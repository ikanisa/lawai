alter table public.eval_results
  add column if not exists maghreb_banner boolean,
  add column if not exists jurisdiction text;
