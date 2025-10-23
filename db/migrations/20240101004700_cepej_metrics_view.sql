-- Aggregated CEPEJ and FRIA metrics for dashboards and exports
CREATE OR REPLACE VIEW public.cepej_metrics AS
SELECT
  org_id,
  count(*) AS assessed_runs,
  count(*) FILTER (
    WHERE
      cepej_passed
  ) AS passed_runs,
  count(*) FILTER (
    WHERE
      NOT cepej_passed
  ) AS violation_runs,
  count(*) FILTER (
    WHERE
      fria_required
  ) AS fria_required_runs,
  CASE
    WHEN count(*) = 0 THEN NULL
    ELSE count(*) FILTER (
      WHERE
        cepej_passed
    )::numeric / nullif(count(*), 0)
  END AS pass_rate
FROM
  public.compliance_assessments
GROUP BY
  org_id;

ALTER VIEW public.cepej_metrics
SET
  (security_invoker = TRUE);

CREATE OR REPLACE VIEW public.cepej_violation_breakdown AS
SELECT
  org_id,
  violation,
  count(*) AS occurrences
FROM
  public.compliance_assessments ca
  LEFT JOIN LATERAL unnest(coalesce(ca.cepej_violations, ARRAY[]::TEXT[])) AS violation ON TRUE
GROUP BY
  org_id,
  violation;

ALTER VIEW public.cepej_violation_breakdown
SET
  (security_invoker = TRUE);
