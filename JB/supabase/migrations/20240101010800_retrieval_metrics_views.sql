-- Aggregate hybrid retrieval metrics for operator dashboards
create or replace view public.org_retrieval_metrics as
with run_stats as (
  select
    ar.org_id,
    ar.id as run_id,
    count(rs.id) filter (where rs.origin = 'local')::numeric as local_snippets,
    count(rs.id) filter (where rs.origin = 'file_search')::numeric as file_snippets
  from public.agent_runs ar
  left join public.run_retrieval_sets rs on rs.run_id = ar.id
  group by ar.org_id, ar.id
),
citation_stats as (
  select
    ar.org_id,
    ar.id as run_id,
    count(rc.id) as total_citations,
    count(rc.id) filter (where public.domain_in_allowlist(rc.url)) as allowlisted_citations,
    bool_or(coalesce(rc.note, '') ilike '%traduction%') as has_translation_warning
  from public.agent_runs ar
  left join public.run_citations rc on rc.run_id = ar.id
  group by ar.org_id, ar.id
),
last_runs as (
  select
    org_id,
    max(finished_at) as last_run_at
  from public.agent_runs
  group by org_id
)
select
  org.id as org_id,
  coalesce(count(distinct rs.run_id), 0) as runs_total,
  case when count(rs.run_id) > 0 then avg(rs.local_snippets) else null end as avg_local_snippets,
  case when count(rs.run_id) > 0 then avg(rs.file_snippets) else null end as avg_file_snippets,
  case
    when coalesce(sum(coalesce(cs.total_citations, 0)), 0) > 0 then
      sum(coalesce(cs.allowlisted_citations, 0))::numeric / nullif(sum(coalesce(cs.total_citations, 0)), 0)
    else null
  end as allowlisted_ratio,
  coalesce(count(distinct cs.run_id) filter (where cs.has_translation_warning), 0) as runs_with_translation_warnings,
  coalesce(count(distinct cs.run_id) filter (where coalesce(cs.total_citations, 0) = 0), 0) as runs_without_citations,
  lr.last_run_at
from public.organizations org
left join run_stats rs on rs.org_id = org.id
left join citation_stats cs on cs.run_id = rs.run_id
left join last_runs lr on lr.org_id = org.id
group by org.id, lr.last_run_at;

alter view public.org_retrieval_metrics set (security_invoker = true);

-- Origin-level snippet distribution and quality metrics
create or replace view public.org_retrieval_origin_metrics as
select
  ar.org_id,
  rs.origin,
  count(rs.id) as snippet_count,
  avg(rs.similarity)::numeric as avg_similarity,
  avg(rs.weight)::numeric as avg_weight
from public.agent_runs ar
left join public.run_retrieval_sets rs on rs.run_id = ar.id
group by ar.org_id, rs.origin;

alter view public.org_retrieval_origin_metrics set (security_invoker = true);

-- Host-level citation telemetry for hybrid retrieval auditing
create or replace view public.org_retrieval_host_metrics as
with parsed as (
  select
    ar.org_id,
    lower(regexp_replace(split_part(split_part(rc.url, '://', 2), '/', 1), '^www\\.', '')) as host,
    rc.url,
    rc.note,
    ar.finished_at
  from public.agent_runs ar
  join public.run_citations rc on rc.run_id = ar.id
)
select
  p.org_id,
  p.host,
  count(*) as citation_count,
  count(*) filter (where public.domain_in_allowlist(p.url)) as allowlisted_count,
  count(*) filter (where coalesce(p.note, '') ilike '%traduction%') as translation_warnings,
  max(p.finished_at) as last_cited_at
from parsed p
where p.host is not null and length(p.host) > 0
group by p.org_id, p.host;

alter view public.org_retrieval_host_metrics set (security_invoker = true);
