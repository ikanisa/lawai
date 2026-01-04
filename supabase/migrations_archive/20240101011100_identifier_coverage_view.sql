-- Aggregate identifier coverage (ELI/ECLI/Akoma Ntoso) by jurisdiction and org
create or replace view public.jurisdiction_identifier_coverage as
select
  org_id,
  jurisdiction_code,
  count(*) as sources_total,
  count(*) filter (where coalesce(eli, '') <> '') as sources_with_eli,
  count(*) filter (where coalesce(ecli, '') <> '') as sources_with_ecli,
  count(*) filter (where akoma_ntoso is not null) as sources_with_akoma,
  coalesce(sum(
    case
      when akoma_ntoso is not null
        and jsonb_typeof(akoma_ntoso) = 'object'
        and jsonb_typeof(akoma_ntoso -> 'body') = 'object'
        and jsonb_typeof(akoma_ntoso -> 'body' -> 'articles') = 'array'
      then jsonb_array_length(akoma_ntoso -> 'body' -> 'articles')
      else 0
    end
  ), 0) as akoma_article_count
from public.sources
group by org_id, jurisdiction_code;
