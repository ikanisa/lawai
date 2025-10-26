-- Track fairness drift alongside drift/evaluation/queue snapshots
ALTER TABLE public.agent_learning_reports
DROP CONSTRAINT if EXISTS agent_learning_reports_kind_check;

ALTER TABLE public.agent_learning_reports
ADD CONSTRAINT agent_learning_reports_kind_check CHECK (
  kind IN ('drift', 'evaluation', 'queue', 'fairness')
);
