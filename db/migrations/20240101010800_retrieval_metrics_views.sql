-- Aggregate hybrid retrieval metrics for operator dashboards
CREATE OR REPLACE VIEW public.org_retrieval_metrics AS
WITH
  run_stats AS (
    SELECT
      ar.org_id,
      ar.id AS run_id,
      count(rs.id) FILTER (
        WHERE
          rs.origin = 'local'
      )::numeric AS local_snippets,
      count(rs.id) FILTER (
        WHERE
          rs.origin = 'file_search'
      )::numeric AS file_snippets
    FROM
      public.agent_runs ar
      LEFT JOIN public.run_retrieval_sets rs ON rs.run_id = ar.id
    GROUP BY
      ar.org_id,
      ar.id
  ),
  citation_stats AS (
    SELECT
      ar.org_id,
      ar.id AS run_id,
      count(rc.id) AS total_citations,
      count(rc.id) FILTER (
        WHERE
          public.domain_in_allowlist (rc.url)
      ) AS allowlisted_citations,
      bool_or(coalesce(rc.note, '') ILIKE '%traduction%') AS has_translation_warning
    FROM
      public.agent_runs ar
      LEFT JOIN public.run_citations rc ON rc.run_id = ar.id
    GROUP BY
      ar.org_id,
      ar.id
  ),
  last_runs AS (
    SELECT
      org_id,
      max(finished_at) AS last_run_at
    FROM
      public.agent_runs
    GROUP BY
      org_id
  )
SELECT
  org.id AS org_id,
  coalesce(count(DISTINCT rs.run_id), 0) AS runs_total,
  CASE
    WHEN count(rs.run_id) > 0 THEN avg(rs.local_snippets)
    ELSE NULL
  END AS avg_local_snippets,
  CASE
    WHEN count(rs.run_id) > 0 THEN avg(rs.file_snippets)
    ELSE NULL
  END AS avg_file_snippets,
  CASE
    WHEN coalesce(sum(coalesce(cs.total_citations, 0)), 0) > 0 THEN sum(coalesce(cs.allowlisted_citations, 0))::numeric / nullif(sum(coalesce(cs.total_citations, 0)), 0)
    ELSE NULL
  END AS allowlisted_ratio,
  coalesce(
    count(DISTINCT cs.run_id) FILTER (
      WHERE
        cs.has_translation_warning
    ),
    0
  ) AS runs_with_translation_warnings,
  coalesce(
    count(DISTINCT cs.run_id) FILTER (
      WHERE
        coalesce(cs.total_citations, 0) = 0
    ),
    0
  ) AS runs_without_citations,
  lr.last_run_at
FROM
  public.organizations org
  LEFT JOIN run_stats rs ON rs.org_id = org.id
  LEFT JOIN citation_stats cs ON cs.run_id = rs.run_id
  LEFT JOIN last_runs lr ON lr.org_id = org.id
GROUP BY
  org.id,
  lr.last_run_at;

ALTER VIEW public.org_retrieval_metrics
SET
  (security_invoker = TRUE);

-- Origin-level snippet distribution and quality metrics
CREATE OR REPLACE VIEW public.org_retrieval_origin_metrics AS
SELECT
  ar.org_id,
  rs.origin,
  count(rs.id) AS snippet_count,
  avg(rs.similarity)::numeric AS avg_similarity,
  avg(rs.weight)::numeric AS avg_weight
FROM
  public.agent_runs ar
  LEFT JOIN public.run_retrieval_sets rs ON rs.run_id = ar.id
GROUP BY
  ar.org_id,
  rs.origin;

ALTER VIEW public.org_retrieval_origin_metrics
SET
  (security_invoker = TRUE);

-- Host-level citation telemetry for hybrid retrieval auditing
CREATE OR REPLACE VIEW public.org_retrieval_host_metrics AS
WITH
  parsed AS (
    SELECT
      ar.org_id,
      lower(
        regexp_replace(
          split_part(split_part(rc.url, '://', 2), '/', 1),
          '^www\\.',
          ''
        )
      ) AS host,
      rc.url,
      rc.note,
      ar.finished_at
    FROM
      public.agent_runs ar
      JOIN public.run_citations rc ON rc.run_id = ar.id
  )
SELECT
  p.org_id,
  p.host,
  count(*) AS citation_count,
  count(*) FILTER (
    WHERE
      public.domain_in_allowlist (p.url)
  ) AS allowlisted_count,
  count(*) FILTER (
    WHERE
      coalesce(p.note, '') ILIKE '%traduction%'
  ) AS translation_warnings,
  max(p.finished_at) AS last_cited_at
FROM
  parsed p
WHERE
  p.host IS NOT NULL
  AND length(p.host) > 0
GROUP BY
  p.org_id,
  p.host;

ALTER VIEW public.org_retrieval_host_metrics
SET
  (security_invoker = TRUE);
