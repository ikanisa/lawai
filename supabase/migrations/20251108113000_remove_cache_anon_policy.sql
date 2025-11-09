-- Migration: Remove anon cache policy
-- Date: 2025-11-08
-- Description: Explicitly drop the anonymous read policy from public.cache to restrict access in existing deployments

-- Drop anonymous read policy if it exists
DROP POLICY IF EXISTS "Anon can read cache" ON public.cache;
