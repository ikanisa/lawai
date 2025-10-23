-- Allow queue snapshots alongside drift and evaluation summaries
ALTER TABLE public.agent_learning_reports
DROP CONSTRAINT if EXISTS agent_learning_reports_kind_check;

ALTER TABLE public.agent_learning_reports
ADD CONSTRAINT agent_learning_reports_kind_check CHECK (kind IN ('drift', 'evaluation', 'queue'));
