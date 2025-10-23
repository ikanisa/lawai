-- Add reviewer response time tracking to HITL queue
ALTER TABLE public.hitl_queue
ADD COLUMN IF NOT EXISTS resolution_minutes numeric,
ADD COLUMN IF NOT EXISTS resolution_bucket text;

CREATE INDEX if NOT EXISTS hitl_queue_resolution_bucket_idx ON public.hitl_queue (resolution_bucket);
