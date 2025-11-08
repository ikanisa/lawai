-- Migration: Netlify caching infrastructure
-- Date: 2025-11-08
-- Description: Creates cache table for Supabase-based caching to replace Vercel/Cloudflare KV
-- Drop legacy cache tables if they exist
DROP TABLE IF EXISTS vercel_cache CASCADE;

DROP TABLE IF EXISTS cloudflare_kv CASCADE;

-- Create cache table for key-value storage
CREATE TABLE IF NOT EXISTS public.cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON public.cache (expires_at);

-- Enable Row Level Security
ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all cache entries
CREATE POLICY "Service role can manage cache" ON public.cache FOR ALL USING (auth.jwt () ->> 'role' = 'service_role');

-- Policy: Allow anon access for reads (if needed for public caching)
CREATE POLICY "Anon can read cache" ON public.cache FOR
SELECT
  USING (TRUE);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache () RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.cache WHERE expires_at < NOW();
END;
$$;

-- Comment on table
COMMENT ON TABLE public.cache IS 'Generic cache table for application-level caching with TTL support';
