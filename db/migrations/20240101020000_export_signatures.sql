ALTER TABLE IF EXISTS public.export_jobs
ADD COLUMN IF NOT EXISTS signature_manifest jsonb,
ADD COLUMN IF NOT EXISTS content_sha256 text;

CREATE INDEX if NOT EXISTS export_jobs_sha_idx ON public.export_jobs USING hash (content_sha256);
