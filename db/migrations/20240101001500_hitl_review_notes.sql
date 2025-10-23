ALTER TABLE public.hitl_queue
ADD COLUMN IF NOT EXISTS reviewer_comment text;
