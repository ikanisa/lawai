-- Extend evaluation metrics with Rwanda language notice coverage
alter table public.eval_results
  add column if not exists rwanda_notice boolean;

create or replace view public.org_evaluation_metrics as
select
  o.id as org_id,
  coalesce(total_cases.total_cases, 0) as total_cases,
  coalesce(results.evaluated_results, 0) as evaluated_results,
  coalesce(results.pass_rate, 0)::numeric as pass_rate,
  results.citation_precision_p95,
  results.temporal_validity_p95,
  results.citation_precision_coverage,
  results.temporal_validity_coverage,
  results.maghreb_banner_coverage,
  results.rwanda_notice_coverage,
  results.last_result_at
from public.organizations o
left join (
  select
    c.org_id,
    count(distinct c.id) as total_cases
  from public.eval_cases c
  group by c.org_id
) total_cases on total_cases.org_id = o.id
left join (
  select
    c.org_id,
    count(r.id) as evaluated_results,
    case
      when count(r.id) = 0 then null
      else sum(case when r.pass then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    end as pass_rate,
    percentile_disc(0.95) within group (order by coalesce(r.citation_precision, 0)) as citation_precision_p95,
    percentile_disc(0.95) within group (order by coalesce(r.temporal_validity, 0)) as temporal_validity_p95,
    case
      when count(r.id) = 0 then null
      else sum(case when coalesce(r.citation_precision, 0) >= 0.95 then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    end as citation_precision_coverage,
    case
      when count(r.id) = 0 then null
      else sum(case when coalesce(r.temporal_validity, 0) >= 0.95 then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    end as temporal_validity_coverage,
    case
      when count(*) filter (where upper(coalesce(r.jurisdiction, '')) in ('MA', 'TN', 'DZ')) = 0 then null
      else sum(
        case
          when upper(coalesce(r.jurisdiction, '')) in ('MA', 'TN', 'DZ') and coalesce(r.maghreb_banner, false) then 1
          when upper(coalesce(r.jurisdiction, '')) in ('MA', 'TN', 'DZ') then 0
          else null
        end
      )::numeric /
      nullif(count(*) filter (where upper(coalesce(r.jurisdiction, '')) in ('MA', 'TN', 'DZ')), 0)
    end as maghreb_banner_coverage,
    case
      when count(*) filter (where upper(coalesce(r.jurisdiction, '')) = 'RW') = 0 then null
      else sum(
        case
          when upper(coalesce(r.jurisdiction, '')) = 'RW' and coalesce(r.rwanda_notice, false) then 1
          when upper(coalesce(r.jurisdiction, '')) = 'RW' then 0
          else null
        end
      )::numeric /
      nullif(count(*) filter (where upper(coalesce(r.jurisdiction, '')) = 'RW'), 0)
    end as rwanda_notice_coverage,
    max(r.created_at) as last_result_at
  from public.eval_cases c
  left join public.eval_results r on r.case_id = c.id
  group by c.org_id
) results on results.org_id = o.id;

alter view public.org_evaluation_metrics set (security_invoker = true);

create or replace view public.org_evaluation_jurisdiction_metrics as
select
  c.org_id,
  case
    when coalesce(nullif(upper(r.jurisdiction), ''), 'UNKNOWN') = 'UNKNOWN' then 'UNKNOWN'
    else upper(r.jurisdiction)
  end as jurisdiction,
  count(r.id) as evaluation_count,
  case
    when count(r.id) = 0 then null
    else sum(case when r.pass then 1 else 0 end)::numeric / nullif(count(r.id), 0)
  end as pass_rate,
  percentile_disc(0.5) within group (order by coalesce(r.citation_precision, 0)) as citation_precision_median,
  percentile_disc(0.5) within group (order by coalesce(r.temporal_validity, 0)) as temporal_validity_median,
  avg(coalesce(r.binding_warnings, 0)) as avg_binding_warnings,
  case
    when upper(coalesce(r.jurisdiction, '')) in ('MA', 'TN', 'DZ') then
      sum(case when coalesce(r.maghreb_banner, false) then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    else null
  end as maghreb_banner_coverage,
  case
    when upper(coalesce(r.jurisdiction, '')) = 'RW' then
      sum(case when coalesce(r.rwanda_notice, false) then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    else null
  end as rwanda_notice_coverage
from public.eval_cases c
join public.eval_results r on r.case_id = c.id
group by c.org_id, jurisdiction;

alter view public.org_evaluation_jurisdiction_metrics set (security_invoker = true);
