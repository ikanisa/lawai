-- Track verification outcomes for each agent run
ALTER TABLE public.agent_runs
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unchecked',
ADD COLUMN IF NOT EXISTS verification_notes jsonb DEFAULT '[]'::jsonb;
