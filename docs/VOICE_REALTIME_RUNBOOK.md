# Voice Realtime Runbook

## Scope
This runbook covers the realtime voice console served at `/voice`. The flow creates ephemeral OpenAI realtime tokens server-side and establishes a WebRTC session from the PWA.

## Architecture
- `/api/realtime/session` issues single-use tokens scoped to organization + user.
- Client `VoiceBar` component connects to OpenAI Realtime via WebRTC, streaming microphone audio and receiving agent responses.
- Tool triggers (deadline calculator, exhibit bundler) surface in the Voice console for follow-up actions.

## Operational Checks
- [ ] Token endpoint returns 200 with expiry <= 60 seconds.
- [ ] WebSocket handshake completes and audio roundtrip latency < 400ms in staging.
- [ ] Automatic captions render in French + English fallback.
- [ ] Voice session gracefully degrades to text-only when bandwidth is low.

## Incident Response
1. **Token Issuance Failure** — Investigate server logs, rotate credentials, and invalidate outstanding tokens.
2. **High Latency** — Switch traffic to backup region, notify infra, and monitor metrics dashboard.
3. **No Audio** — Validate microphone permissions, check WebRTC ICE servers, and attempt renegotiation.
4. **Tool Trigger Errors** — Inspect `tool_telemetry` entries, retry invocation, and escalate to agents team if persistent.

## Backout Plan
- Disable voice entry point via `FEAT_VOICE_REALTIME` feature flag.
- Remove `/voice` navigation entry from AppShell via config.
- Publish incident notice and update status page.
