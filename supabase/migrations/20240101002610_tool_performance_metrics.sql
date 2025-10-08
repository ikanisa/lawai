-- Recreate tool performance metrics view in a conflict-safe way
CREATE OR REPLACE VIEW public.tool_performance_metrics AS
SELECT
  org_id,
  tool_name,
  COUNT(*) AS total_invocations,
  COUNT(*) FILTER (WHERE success) AS success_count,
  COUNT(*) FILTER (WHERE NOT success) AS failure_count,
  AVG(latency_ms)::numeric AS avg_latency_ms,
  percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  MAX(created_at) AS last_invoked_at
FROM public.tool_telemetry
GROUP BY org_id, tool_name;

ALTER VIEW public.tool_performance_metrics SET (security_invoker = TRUE);
