import {
  AgentRunRequestSchema,
  AgentRunSchema,
  ResearchStreamPayloadSchema,
  type AgentRun,
  type AgentRunRequest,
  type ResearchStreamEvent,
  type ResearchStreamPayload,
} from '@avocat-ai/shared';

export interface AgentClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface AgentStreamOptions {
  agentId: string;
  runId: string;
  threadId: string;
  input: string;
  toolsEnabled?: string[];
  signal?: AbortSignal;
  onEvent: (event: ResearchStreamEvent) => void;
}

export interface AgentClient {
  runAgent(request: AgentRunRequest): Promise<AgentRun>;
  streamAgent(options: AgentStreamOptions): Promise<void>;
}

export function createAgentClient(options: AgentClientOptions): AgentClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function runAgent(request: AgentRunRequest): Promise<AgentRun> {
    const payload = AgentRunRequestSchema.parse(request);
    const response = await fetchImpl(`${baseUrl}/agents/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Agent run failed: ${response.status} ${body}`);
    }

    const json = await response.json();
    return AgentRunSchema.parse(json);
  }

  async function streamAgent({
    agentId,
    runId,
    threadId,
    input,
    toolsEnabled = [],
    signal,
    onEvent,
  }: AgentStreamOptions): Promise<void> {
    const response = await fetchImpl(`${baseUrl}/agents/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, run_id: runId, thread_id: threadId, input, tools_enabled: toolsEnabled }),
      signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`Agent stream failed: ${response.status} ${body}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          const event = JSON.parse(line) as ResearchStreamEvent;
          if (event.type !== 'done') {
            ResearchStreamPayloadSchema.parse(event.data as ResearchStreamPayload);
          }
          onEvent(event);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }
  }

  return { runAgent, streamAgent };
}
