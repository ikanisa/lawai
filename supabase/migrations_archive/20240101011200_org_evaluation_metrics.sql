-- Aggregate evaluation telemetry for operator dashboards
CREATE OR REPLACE VIEW public.org_evaluation_metrics AS
SELECT
  o.id AS org_id,
  coalesce(total_cases.total_cases, 0) AS total_cases,
  coalesce(results.evaluated_results, 0) AS evaluated_results,
  coalesce(results.pass_rate, 0)::numeric AS pass_rate,
  results.citation_precision_p95,
  results.temporal_validity_p95,
  results.citation_precision_coverage,
  results.temporal_validity_coverage,
  results.maghreb_banner_coverage,
  results.last_result_at
FROM
  public.organizations o
  LEFT JOIN (
    SELECT
      c.org_id,
      count(DISTINCT c.id) AS total_cases
    FROM
      public.eval_cases c
    GROUP BY
      c.org_id
  ) total_cases ON total_cases.org_id = o.id
  LEFT JOIN (
    SELECT
      c.org_id,
      count(r.id) AS evaluated_results,
      CASE
        WHEN count(r.id) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN r.pass THEN 1
            ELSE 0
          END
        )::numeric / nullif(count(r.id), 0)
      END AS pass_rate,
      percentile_disc(0.95) WITHIN GROUP (
        ORDER BY
          coalesce(r.citation_precision, 0)
      ) AS citation_precision_p95,
      percentile_disc(0.95) WITHIN GROUP (
        ORDER BY
          coalesce(r.temporal_validity, 0)
      ) AS temporal_validity_p95,
      CASE
        WHEN count(r.id) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN coalesce(r.citation_precision, 0) >= 0.95 THEN 1
            ELSE 0
          END
        )::numeric / nullif(count(r.id), 0)
      END AS citation_precision_coverage,
      CASE
        WHEN count(r.id) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN coalesce(r.temporal_validity, 0) >= 0.95 THEN 1
            ELSE 0
          END
        )::numeric / nullif(count(r.id), 0)
      END AS temporal_validity_coverage,
      CASE
        WHEN count(*) FILTER (
          WHERE
            upper(coalesce(r.jurisdiction, '')) IN ('MA', 'TN', 'DZ')
        ) = 0 THEN NULL
        ELSE sum(
          CASE
            WHEN upper(coalesce(r.jurisdiction, '')) IN ('MA', 'TN', 'DZ')
            AND coalesce(r.maghreb_banner, FALSE) THEN 1
            WHEN upper(coalesce(r.jurisdiction, '')) IN ('MA', 'TN', 'DZ') THEN 0
            ELSE NULL
          END
        )::numeric / nullif(
          count(*) FILTER (
            WHERE
              upper(coalesce(r.jurisdiction, '')) IN ('MA', 'TN', 'DZ')
          ),
          0
        )
      END AS maghreb_banner_coverage,
      max(r.created_at) AS last_result_at
    FROM
      public.eval_cases c
      LEFT JOIN public.eval_results r ON r.case_id = c.id
    GROUP BY
      c.org_id
  ) results ON results.org_id = o.id;

ALTER VIEW public.org_evaluation_metrics
SET
  (security_invoker = TRUE);

CREATE OR REPLACE VIEW public.org_evaluation_jurisdiction_metrics AS
SELECT
  c.org_id,
  CASE
    WHEN coalesce(nullif(upper(r.jurisdiction), ''), 'UNKNOWN') = 'UNKNOWN' THEN 'UNKNOWN'
    ELSE upper(r.jurisdiction)
  END AS jurisdiction,
  count(r.id) AS evaluation_count,
  CASE
    WHEN count(r.id) = 0 THEN NULL
    ELSE sum(
      CASE
        WHEN r.pass THEN 1
        ELSE 0
      END
    )::numeric / nullif(count(r.id), 0)
  END AS pass_rate,
  percentile_disc(0.5) WITHIN GROUP (
    ORDER BY
      coalesce(r.citation_precision, 0)
  ) AS citation_precision_median,
  percentile_disc(0.5) WITHIN GROUP (
    ORDER BY
      coalesce(r.temporal_validity, 0)
  ) AS temporal_validity_median,
  avg(coalesce(r.binding_warnings, 0)) AS avg_binding_warnings,
  CASE
    WHEN upper(coalesce(r.jurisdiction, '')) IN ('MA', 'TN', 'DZ') THEN sum(
      CASE
        WHEN coalesce(r.maghreb_banner, FALSE) THEN 1
        ELSE 0
      END
    )::numeric / nullif(count(r.id), 0)
    ELSE NULL
  END AS maghreb_banner_coverage
FROM
  public.eval_cases c
  JOIN public.eval_results r ON r.case_id = c.id
GROUP BY
  c.org_id,
  jurisdiction;

ALTER VIEW public.org_evaluation_jurisdiction_metrics
SET
  (security_invoker = TRUE);
