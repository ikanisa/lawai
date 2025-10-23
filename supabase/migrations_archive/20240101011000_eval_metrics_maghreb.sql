ALTER TABLE public.eval_results
ADD COLUMN IF NOT EXISTS maghreb_banner boolean,
ADD COLUMN IF NOT EXISTS jurisdiction text;
