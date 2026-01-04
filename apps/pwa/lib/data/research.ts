import { apiFetch } from "@/lib/apiClient";
import { consumeEventStream, type StreamEvent } from "@/lib/openaiStream";
import type { AgentRun, ResearchDeskContext, ResearchStreamPayload } from "@avocat-ai/shared";

export type {
  ResearchPlan,
  ResearchPlanStep,
  ResearchCitation,
  ResearchFilterOption,
  ResearchRiskLevel,
  ResearchDeskContext
} from "@avocat-ai/shared";

export type ResearchStreamEvent = StreamEvent<ResearchStreamPayload>;

interface StartResearchRunOptions {
  agentId?: string;
  toolsEnabled?: string[];
  jurisdiction?: string | null;
  policyFlags?: string[];
}

export async function fetchResearchDeskContext(): Promise<ResearchDeskContext> {
  return apiFetch<ResearchDeskContext>({ path: "/api/research/context" });
}

export function startResearchRun(
  input: string,
  onEvent: (event: ResearchStreamEvent) => void,
  { agentId = "research", toolsEnabled = [], jurisdiction, policyFlags = [] }: StartResearchRunOptions = {}
): () => void {
  const controller = new AbortController();

  void (async () => {
    let run: AgentRun | null = null;
    try {
      run = await apiFetch<AgentRun>({
        path: "/api/agents/run",
        method: "POST",
        body: {
          input,
          agent_id: agentId,
          tools_enabled: toolsEnabled,
          jurisdiction: jurisdiction ?? undefined,
          policy_flags: policyFlags,
        },
      });
    } catch (error) {
      console.error("Failed to create agent run", error);
      onEvent({ type: "done", data: {} as ResearchStreamPayload });
      return;
    }

    try {
      const response = await fetch("/api/agents/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          agent_id: run.agentId,
          run_id: run.id,
          thread_id: run.threadId,
          tools_enabled: toolsEnabled,
        }),
        signal: controller.signal,
      });

      await consumeEventStream<ResearchStreamPayload>(response, (event) => {
        onEvent(event as ResearchStreamEvent);
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Agent stream failed", error);
      onEvent({ type: "done", data: {} as ResearchStreamPayload });
    }
  })();

  return () => controller.abort();
}
