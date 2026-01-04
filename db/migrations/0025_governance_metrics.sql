-- Aggregated governance and performance metrics for dashboards
create or replace view public.org_metrics as
select
  o.id as org_id,
  o.name,
  coalesce(runs.total_runs, 0) as total_runs,
  coalesce(runs.runs_last_30_days, 0) as runs_last_30_days,
  coalesce(runs.high_risk_runs, 0) as high_risk_runs,
  coalesce(runs.confidential_runs, 0) as confidential_runs,
  coalesce(runs.avg_latency_ms, 0)::bigint as avg_latency_ms,
  coalesce(runs.allowlisted_ratio, 0)::numeric as allowlisted_citation_ratio,
  coalesce(hitl.pending, 0) as hitl_pending,
  coalesce(hitl.median_response_minutes, 0)::numeric as hitl_median_response_minutes,
  coalesce(ingestion.success_7d, 0) as ingestion_success_last_7_days,
  coalesce(ingestion.failed_7d, 0) as ingestion_failed_last_7_days,
  coalesce(eval_summary.total_cases, 0) as evaluation_cases,
  coalesce(eval_summary.pass_rate, 0)::numeric as evaluation_pass_rate
from public.organizations o
left join (
  select
    r.org_id,
    count(*) as total_runs,
    count(*) filter (where r.started_at >= now() - interval '30 days') as runs_last_30_days,
    count(*) filter (where coalesce(r.risk_level, 'LOW') = 'HIGH') as high_risk_runs,
    count(*) filter (where r.confidential_mode) as confidential_runs,
    avg(extract(epoch from (coalesce(r.finished_at, now()) - r.started_at)) * 1000) as avg_latency_ms,
    case
      when count(rc.id) = 0 then null
      else sum(case when rc.domain_ok then 1 else 0 end)::numeric / nullif(count(rc.id), 0)
    end as allowlisted_ratio
  from public.agent_runs r
  left join public.run_citations rc on rc.run_id = r.id
  group by r.org_id
) runs on runs.org_id = o.id
left join (
  select
    org_id,
    count(*) filter (where status = 'pending') as pending,
    percentile_disc(0.5) within group (order by extract(epoch from (coalesce(updated_at, now()) - created_at)) / 60.0) as median_response_minutes
  from public.hitl_queue
  group by org_id
) hitl on hitl.org_id = o.id
left join (
  select
    org_id,
    count(*) filter (where status = 'succeeded' and started_at >= now() - interval '7 days') as success_7d,
    count(*) filter (where status <> 'succeeded' and started_at >= now() - interval '7 days') as failed_7d
  from public.ingestion_runs
  group by org_id
) ingestion on ingestion.org_id = o.id
left join (
  select
    c.org_id,
    count(distinct c.id) as total_cases,
    case
      when count(r.id) = 0 then null
      else sum(case when r.pass then 1 else 0 end)::numeric / nullif(count(r.id), 0)
    end as pass_rate
  from public.eval_cases c
  left join public.eval_results r on r.case_id = c.id
  group by c.org_id
) eval_summary on eval_summary.org_id = o.id;

alter view public.org_metrics set (security_invoker = true);

create or replace view public.tool_performance_metrics as
select
  org_id,
  tool_name,
  count(*) as total_invocations,
  count(*) filter (where success) as success_count,
  count(*) filter (where not success) as failure_count,
  avg(latency_ms)::numeric as avg_latency_ms,
  percentile_disc(0.95) within group (order by latency_ms) as p95_latency_ms,
  max(created_at) as last_invoked_at
from public.tool_telemetry
group by org_id, tool_name;

alter view public.tool_performance_metrics set (security_invoker = true);
