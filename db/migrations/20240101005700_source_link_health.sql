-- Add link health tracking and residency metadata to authoritative sources
ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS link_last_checked_at timestamptz,
ADD COLUMN IF NOT EXISTS link_last_status text CHECK (link_last_status IN ('ok', 'failed', 'stale')),
ADD COLUMN IF NOT EXISTS link_last_error text,
ADD COLUMN IF NOT EXISTS residency_zone text;

CREATE INDEX if NOT EXISTS sources_link_status_idx ON public.sources (link_last_status);

CREATE INDEX if NOT EXISTS sources_residency_idx ON public.sources (residency_zone);

ALTER TABLE public.authority_domains
ADD COLUMN IF NOT EXISTS last_failed_at timestamptz,
ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;
