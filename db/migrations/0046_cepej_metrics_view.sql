-- Aggregated CEPEJ and FRIA metrics for dashboards and exports
create or replace view public.cepej_metrics as
select
  org_id,
  count(*) as assessed_runs,
  count(*) filter (where cepej_passed) as passed_runs,
  count(*) filter (where not cepej_passed) as violation_runs,
  count(*) filter (where fria_required) as fria_required_runs,
  case when count(*) = 0 then null else count(*) filter (where cepej_passed)::numeric / nullif(count(*), 0) end as pass_rate
from public.compliance_assessments
group by org_id;

alter view public.cepej_metrics set (security_invoker = true);

create or replace view public.cepej_violation_breakdown as
select
  org_id,
  violation,
  count(*) as occurrences
from public.compliance_assessments ca
  left join lateral unnest(coalesce(ca.cepej_violations, array[]::text[])) as violation on true
group by org_id, violation;

alter view public.cepej_violation_breakdown set (security_invoker = true);
