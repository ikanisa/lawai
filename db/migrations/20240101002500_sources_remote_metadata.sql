-- Track remote HTTP metadata for change detection
ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS http_etag text,
ADD COLUMN IF NOT EXISTS last_modified timestamptz;

ALTER TABLE public.run_citations
ADD COLUMN IF NOT EXISTS note text;
