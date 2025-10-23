CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  agent_name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('web', 'voice')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  chatkit_session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX if NOT EXISTS chat_sessions_org_idx ON chat_sessions (org_id);

CREATE INDEX if NOT EXISTS chat_sessions_status_idx ON chat_sessions (status);

CREATE INDEX if NOT EXISTS chat_sessions_created_idx ON chat_sessions (created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content text NOT NULL,
  attachments jsonb,
  tool_invocation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS chat_messages_session_idx ON chat_messages (session_id);

CREATE INDEX if NOT EXISTS chat_messages_created_idx ON chat_messages (created_at);

CREATE TABLE IF NOT EXISTS chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  actor_type text,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS chat_events_session_idx ON chat_events (session_id);

CREATE INDEX if NOT EXISTS chat_events_type_idx ON chat_events (event_type);

ALTER TABLE chat_sessions enable ROW level security;

ALTER TABLE chat_messages enable ROW level security;

ALTER TABLE chat_events enable ROW level security;

CREATE POLICY if NOT EXISTS chat_sessions_service_role_full_access ON chat_sessions FOR ALL USING (auth.role () = 'service_role');

CREATE POLICY if NOT EXISTS chat_messages_service_role_full_access ON chat_messages FOR ALL USING (auth.role () = 'service_role');

CREATE POLICY if NOT EXISTS chat_events_service_role_full_access ON chat_events FOR ALL USING (auth.role () = 'service_role');
