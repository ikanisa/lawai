-- Aggregate identifier coverage (ELI/ECLI/Akoma Ntoso) by jurisdiction and org
CREATE OR REPLACE VIEW public.jurisdiction_identifier_coverage AS
SELECT
  org_id,
  jurisdiction_code,
  count(*) AS sources_total,
  count(*) FILTER (
    WHERE
      coalesce(eli, '') <> ''
  ) AS sources_with_eli,
  count(*) FILTER (
    WHERE
      coalesce(ecli, '') <> ''
  ) AS sources_with_ecli,
  count(*) FILTER (
    WHERE
      akoma_ntoso IS NOT NULL
  ) AS sources_with_akoma,
  coalesce(
    sum(
      CASE
        WHEN akoma_ntoso IS NOT NULL
        AND jsonb_typeof(akoma_ntoso) = 'object'
        AND jsonb_typeof(akoma_ntoso -> 'body') = 'object'
        AND jsonb_typeof(akoma_ntoso -> 'body' -> 'articles') = 'array' THEN jsonb_array_length(akoma_ntoso -> 'body' -> 'articles')
        ELSE 0
      END
    ),
    0
  ) AS akoma_article_count
FROM
  public.sources
GROUP BY
  org_id,
  jurisdiction_code;
