-- Track fairness drift alongside drift/evaluation/queue snapshots
alter table public.agent_learning_reports
  drop constraint if exists agent_learning_reports_kind_check;

alter table public.agent_learning_reports
  add constraint agent_learning_reports_kind_check
    check (kind in ('drift', 'evaluation', 'queue', 'fairness'));
