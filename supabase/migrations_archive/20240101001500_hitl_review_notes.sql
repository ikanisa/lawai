alter table public.hitl_queue
  add column if not exists reviewer_comment text;
