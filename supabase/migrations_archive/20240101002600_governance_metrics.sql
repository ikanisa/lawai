-- Aggregated governance and performance metrics for dashboards
CREATE OR REPLACE VIEW public.org_metrics AS
SELECT
  o.id AS org_id,
  o.name,
  coalesce(runs.total_runs, 0) AS total_runs,
  coalesce(runs.runs_last_30_days, 0) AS runs_last_30_days,
  coalesce(runs.high_risk_runs, 0) AS high_risk_runs,
  coalesce(runs.confidential_runs, 0) AS confidential_runs,
  coalesce(runs.avg_latency_ms, 0)::bigint AS avg_latency_ms,
  coalesce(runs.allowlisted_ratio, 0)::numeric AS allowlisted_citation_ratio,
  coalesce(hitl.pending, 0) AS hitl_pending,
  coalesce(hitl.median_response_minutes, 0)::numeric AS hitl_median_response_minutes,
  coalesce(ingestion.success_7d, 0) AS ingestion_success_last_7_days,
  coalesce(ingestion.failed_7d, 0) AS ingestion_failed_last_7_days,
  coalesce(eval_summary.total_cases, 0) AS evaluation_cases,
  coalesce(eval_summary.pass_rate, 0)::numeric AS evaluation_pass_rate
FROM
  public.organizations o
  LEFT JOIN (
    SELECT
      r.org_id,
      count(*) AS total_runs,
      count(*) FILTER (
        WHERE
          r.started_at >= now() - interval '30 days'
      ) AS runs_last_30_days,
      count(*) FILTER (
        WHERE
          coalesce(r.risk_level, 'LOW') = 'HIGH'
      ) AS high_risk_runs,
      count(*) FILTER (
        WHERE
          r.confidential_mode
      ) AS confidential_runs,
      avg(
        extract(
          epoch
          FROM
            (coalesce(r.finished_at, now()) - r.started_at)
        ) * 1000
      ) AS avg_latency_ms,
      CASE
        WHEN count(rc.id) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN rc.domain_ok THEN 1
            ELSE 0
          END
        )::numeric / nullif(count(rc.id), 0)
      END AS allowlisted_ratio
    FROM
      public.agent_runs r
      LEFT JOIN public.run_citations rc ON rc.run_id = r.id
    GROUP BY
      r.org_id
  ) runs ON runs.org_id = o.id
  LEFT JOIN (
    SELECT
      org_id,
      count(*) FILTER (
        WHERE
          status = 'pending'
      ) AS pending,
      percentile_disc(0.5) WITHIN GROUP (
        ORDER BY
          extract(
            epoch
            FROM
              (coalesce(updated_at, now()) - created_at)
          ) / 60.0
      ) AS median_response_minutes
    FROM
      public.hitl_queue
    GROUP BY
      org_id
  ) hitl ON hitl.org_id = o.id
  LEFT JOIN (
    SELECT
      org_id,
      count(*) FILTER (
        WHERE
          status = 'succeeded'
          AND started_at >= now() - interval '7 days'
      ) AS success_7d,
      count(*) FILTER (
        WHERE
          status <> 'succeeded'
          AND started_at >= now() - interval '7 days'
      ) AS failed_7d
    FROM
      public.ingestion_runs
    GROUP BY
      org_id
  ) ingestion ON ingestion.org_id = o.id
  LEFT JOIN (
    SELECT
      c.org_id,
      count(DISTINCT c.id) AS total_cases,
      CASE
        WHEN count(r.id) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN r.pass THEN 1
            ELSE 0
          END
        )::numeric / nullif(count(r.id), 0)
      END AS pass_rate
    FROM
      public.eval_cases c
      LEFT JOIN public.eval_results r ON r.case_id = c.id
    GROUP BY
      c.org_id
  ) eval_summary ON eval_summary.org_id = o.id;

ALTER VIEW public.org_metrics
SET
  (security_invoker = TRUE);

CREATE OR REPLACE VIEW public.tool_performance_metrics AS
SELECT
  org_id,
  tool_name,
  count(*) AS total_invocations,
  count(*) FILTER (
    WHERE
      success
  ) AS success_count,
  count(*) FILTER (
    WHERE
      NOT success
  ) AS failure_count,
  avg(latency_ms)::numeric AS avg_latency_ms,
  percentile_disc(0.95) WITHIN GROUP (
    ORDER BY
      latency_ms
  ) AS p95_latency_ms,
  max(created_at) AS last_invoked_at
FROM
  public.tool_telemetry
GROUP BY
  org_id,
  tool_name;

ALTER VIEW public.tool_performance_metrics
SET
  (security_invoker = TRUE);
