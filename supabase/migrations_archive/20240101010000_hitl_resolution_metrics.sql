-- Add reviewer response time tracking to HITL queue
alter table public.hitl_queue
  add column if not exists resolution_minutes numeric,
  add column if not exists resolution_bucket text;

create index if not exists hitl_queue_resolution_bucket_idx
  on public.hitl_queue (resolution_bucket);
