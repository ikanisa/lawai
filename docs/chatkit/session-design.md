# ChatKit Session Integration Plan

## Objectives
- Provide persistent conversation state across devices and agents.
- Minimise HITL: human interventions happen via chat buttons/action cards.
- Support orchestration between finance agents via session metadata.

## Data Model (Supabase Proposal)
| Table | Columns | Notes |
| --- | --- | --- |
| `chat_sessions` | `id (uuid)` primary key, `org_id`, `user_id`, `channel` (`web`/`voice`), `agent_id`, `status` (`active`/`ended`), `created_at`, `ended_at`, `metadata (jsonb)` | Map ChatKit session ID to tenancy/user context. |
| `chat_messages` | `id`, `session_id`, `role` (`user`/`agent`/`system`), `content`, `attachments`, `created_at`, `tool_invocation_id` | Optional until ChatKit message stores are leveraged; useful for replay/throttling. |
| `chat_events` | `id`, `session_id`, `type` (`button_click`, `hitl_escalation`, etc.), `payload`, `created_at` | For auditing UI-triggered actions. |

## API Surface (Backend)
| Endpoint | Method | Description |
| --- | --- | --- |
| `/chatkit/sessions` | POST | Creates a ChatKit session using OpenAI API; returns session ID + ephemeral tokens if required. |
| `/chatkit/sessions/:id` | GET | Fetch metadata from Supabase + ChatKit to power UI. |
| `/chatkit/sessions/:id/cancel` | POST | Cancels ChatKit session (call OpenAI cancel API + mark Supabase record). |
| `/chatkit/sessions/:id/events` | POST | Record UI events (button actions) to support automation metrics. |

## Integration Sequence
1. **Session creation**: API receives request → calls OpenAI ChatKit sessions API (when configured) → stores returned session ID + tokens in Supabase; response payload includes `chatkit.clientSecret` for the frontend to establish the real-time connection.
2. **Frontend connection**: Web client uses returned session info to establish streaming channel (SSE/WebRTC) to ChatKit; attaches metadata (selected agent, org).
3. **Agent orchestration**: Orchestrator listens for session events (tool calls, button actions) and routes to appropriate finance agent via MCP.
4. **Session termination**: On cancel/expiry → call ChatKit cancel endpoint → update Supabase status; optionally emit audit event.

## Outstanding Tasks
- [ ] Confirm ChatKit authentication model (API keys vs ephemeral tokens) and extend config (`OPENAI_CHATKIT_PROJECT`, `OPENAI_CHATKIT_SECRET`).
- [x] Implement Supabase schema migrations (`chat_sessions`, `chat_messages`, `chat_events`).
- [x] Update `apps/api/src/chatkit.ts` to call real ChatKit API once credentials available.
- [x] Expose REST endpoints in Fastify router (`/chatkit/*`).
- [ ] Design UI components for session handover (task cards, escalations) with reduced HITL.
- [ ] Instrument logging/metrics (session counts, cancel rates, time-to-escalation).
