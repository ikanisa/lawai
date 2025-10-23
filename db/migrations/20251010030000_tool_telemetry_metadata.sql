ALTER TABLE public.tool_telemetry
  ADD COLUMN IF NOT EXISTS metadata jsonb;
