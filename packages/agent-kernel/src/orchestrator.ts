import {
  Agent,
  OpenAIProvider,
  run as runAgent,
  setDefaultModelProvider,
  setDefaultOpenAIKey,
  setOpenAIAPI,
} from '@openai/agents';
import {
  FinanceDirectorPlanSchema,
  FinanceSafetyReviewSchema,
  type FinanceDirectorPlan,
  type FinanceSafetyReview,
  type OrchestratorCommandEnvelope,
  type SafetyAssessmentResult,
} from '@avocat-ai/shared';
import { z } from 'zod';
import { validateDirectorPlanBudget } from './budget.js';
import type {
  AgentKernelOptions,
  AuditLogEntry,
  DirectorPlanningInput,
  KernelLogger,
  PolicyGate,
  PolicyGateContext,
  PolicyGateDecision,
  SafetyAssessmentInput,
  SafetyAssessmentWithFilters,
  SafetyFilter,
  SafetyFilterContext,
  SafetyFilterDecision,
} from './types.js';

const DirectorPlanningInputSchema = z.object({
  session: z.any(),
  objective: z.string().min(1),
  context: z.record(z.any()).default({}),
});

const SafetyAssessmentInputSchema = z.object({
  envelope: z.any(),
});

const DIRECTOR_INSTRUCTIONS = `Tu es "Le Directeur", l'orchestrateur MCP des agents financiers (taxe, audit, AP, CFO, risque, conformité).

Ta mission:
1. Analyser l'objectif métier et le contexte conversationnel (session ChatKit + Supabase).
2. Planifier des étapes explicites avec agents délégués, budgets outils, critères de succès et garde-fous HITL.
3. S'appuyer sur l'état persistant (Supabase) pour mémoriser décisions, blockers et métadonnées.
4. Déléguer aux agents de domaine via des commandes structurées, en respectant les politiques résidence/confidentialité.
5. Synchroniser les connecteurs (ERP, fiscalité, compta) avant de déclencher une action qui en dépend.
6. Toujours informer la Safety Agent si la tâche implique un risque élevé, une divulgation réglementaire ou un écart de politique.

Contraintes:
- Pas de chaîne de pensée: retourne uniquement plans structurés, commandes ou résumés homologables.
- Si l'objectif te semble ambigu, créer une commande "clarify" pour l'utilisateur humain.
- Pour chaque commande, indique le worker cible (domain|director|safety), priorité, détection HITL, dépendances.
- Ne jamais ignorer les signaux de politique Supabase (ban analytique juge, confidentialité, résidence).
`;

const SAFETY_INSTRUCTIONS = `Tu es "Safety", garante de la conformité et des politiques de sécurité:
- Vérifie chaque commande/directive reçue du Directeur.
- Signale les anomalies (confidentialité, résidence, guardrails, obligations réglementaires) et propose des mitigations.
- Peut basculer une commande en HITL ou refuser l'exécution.
- Maintient un journal Supabase des contrôles effectués.
`;

function drainAgentStream(response: unknown, logger?: KernelLogger): Promise<void> {
  if (!response || typeof response !== 'object') {
    return Promise.resolve();
  }

  const candidate =
    (response as Record<string, unknown>).stream ??
    (response as Record<string, unknown>).eventStream ??
    (response as Record<string, unknown>).events ??
    null;

  if (!candidate || typeof candidate !== 'object' || typeof (candidate as any)[Symbol.asyncIterator] !== 'function') {
    return Promise.resolve();
  }

  const iterable = candidate as AsyncIterable<unknown>;

  return (async () => {
    try {
      for await (const _event of iterable) {
        // consume stream
      }
    } catch (error) {
      logger?.warn?.(
        { err: error instanceof Error ? error.message : error },
        'agent_stream_drain_failed',
      );
    }
  })();
}

function mapFilterToAssessment(decision: SafetyFilterDecision): SafetyAssessmentResult {
  switch (decision.action) {
    case 'needs_hitl':
      return {
        status: 'needs_hitl',
        reasons: decision.reasons ?? ['HITL escalation required'],
        mitigations: decision.mitigations,
      };
    case 'block':
      return {
        status: 'rejected',
        reasons: decision.reasons ?? ['Blocked by safety policy'],
        mitigations: decision.mitigations,
      };
    default:
      return {
        status: 'approved',
        reasons: decision.reasons ?? [],
        mitigations: decision.mitigations,
      };
  }
}

function mapAssessmentToDecision(result: SafetyAssessmentResult): SafetyFilterDecision {
  switch (result.status) {
    case 'needs_hitl':
      return { action: 'needs_hitl', reasons: result.reasons, mitigations: result.mitigations };
    case 'rejected':
      return { action: 'block', reasons: result.reasons, mitigations: result.mitigations };
    default:
      return { action: 'allow', reasons: result.reasons, mitigations: result.mitigations };
  }
}

function shouldShortCircuit(decision: SafetyFilterDecision | void): decision is SafetyFilterDecision {
  return Boolean(decision && decision.action !== 'allow');
}

function applyPolicyGates(
  gates: PolicyGate[] | undefined,
  context: PolicyGateContext,
  logger?: KernelLogger,
): Promise<PolicyGateDecision | null> {
  if (!gates?.length) {
    return Promise.resolve(null);
  }

  return gates.reduce<Promise<PolicyGateDecision | null>>(async (accPromise, gate) => {
    const acc = await accPromise;
    if (acc && acc.action === 'block') {
      return acc;
    }
    try {
      const decision = await gate(context);
      if (decision && decision.action === 'block') {
        return decision;
      }
      return acc;
    } catch (error) {
      logger?.error?.(
        {
          err: error instanceof Error ? error.message : error,
          stage: context.stage,
        },
        'policy_gate_error',
      );
      return {
        action: 'block',
        reason: error instanceof Error ? error.message : 'policy_gate_error',
      };
    }
  }, Promise.resolve<PolicyGateDecision | null>(null));
}

export class FinanceAgentKernel {
  private readonly options: AgentKernelOptions;
  private directorAgent: Agent<unknown, typeof FinanceDirectorPlanSchema> | null = null;
  private safetyAgent: Agent<unknown, typeof FinanceSafetyReviewSchema> | null = null;
  private providerConfigured = false;

  constructor(options: AgentKernelOptions) {
    this.options = options;
  }

  private ensureProvider(): void {
    if (this.providerConfigured) {
      return;
    }
    setDefaultOpenAIKey(this.options.openAIKey);
    setOpenAIAPI('responses');
    setDefaultModelProvider(
      new OpenAIProvider({
        apiKey: this.options.openAIKey,
        useResponses: true,
      }),
    );
    this.providerConfigured = true;
  }

  private getDirectorAgent() {
    if (!this.directorAgent) {
      this.ensureProvider();
      this.directorAgent = new Agent({
        name: 'finance-director',
        instructions: DIRECTOR_INSTRUCTIONS,
        model: this.options.model,
        outputType: FinanceDirectorPlanSchema,
      });
    }
    return this.directorAgent!;
  }

  private getSafetyAgent() {
    if (!this.safetyAgent) {
      this.ensureProvider();
      this.safetyAgent = new Agent({
        name: 'finance-safety',
        instructions: SAFETY_INSTRUCTIONS,
        model: this.options.model,
        outputType: FinanceSafetyReviewSchema,
      });
    }
    return this.safetyAgent!;
  }

  private async runWithTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    const timeoutMs = this.options.llmTimeoutMs;
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    let timeoutHandle: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${operation}_timeout`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result as T;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private recordAudit(entry: AuditLogEntry): void {
    if (!this.options.auditLogger) {
      return;
    }
    const handleError = (error: unknown) => {
      this.options.logger?.warn?.(
        { err: error instanceof Error ? error.message : error, event: entry.event },
        'audit_logger_failed',
      );
    };

    try {
      const result = this.options.auditLogger.record(entry);
      if (typeof (result as Promise<unknown>)?.catch === 'function') {
        (result as Promise<unknown>).catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  }

  private async applyFilters(
    filters: SafetyFilter[] | undefined,
    context: SafetyFilterContext,
  ): Promise<SafetyFilterDecision[]> {
    if (!filters?.length) {
      return [];
    }

    const applied: SafetyFilterDecision[] = [];

    for (const filter of filters) {
      try {
        const decision = await filter(context);
        if (decision) {
          applied.push(decision);
          if (decision.action !== 'allow') {
            break;
          }
        }
      } catch (error) {
        this.options.logger?.warn?.(
          { err: error instanceof Error ? error.message : error, phase: context.phase },
          'safety_filter_failed',
        );
      }
    }

    return applied;
  }

  async runDirectorPlanning(input: DirectorPlanningInput): Promise<FinanceDirectorPlan> {
    const parsed = DirectorPlanningInputSchema.parse(input);
    const gateDecision = await applyPolicyGates(this.options.policyGates, {
      stage: 'director_plan',
      orgId: parsed.session.orgId,
      session: parsed.session,
    }, this.options.logger);

    if (gateDecision?.action === 'block') {
      const detail = gateDecision.reason ?? 'policy_gate_blocked';
      this.recordAudit({
        event: 'policy_gate',
        actor: 'kernel',
        outcome: 'blocked',
        orgId: parsed.session.orgId,
        sessionId: parsed.session.id,
        detail,
        metadata: gateDecision.metadata,
      });
      throw new Error(detail);
    }

    const agent = this.getDirectorAgent();

    try {
      const payload = {
        session: parsed.session,
        objective: parsed.objective,
        context: parsed.context,
      };
      const responsePromise = runAgent(agent, `${DIRECTOR_INSTRUCTIONS}\n\n${JSON.stringify(payload)}`, {
        model: this.options.model,
        metadata: {
          orgId: parsed.session.orgId,
          sessionId: parsed.session.id,
          objective: parsed.objective,
          kind: 'director_plan',
        },
      } as any);

      const response = await this.runWithTimeout(responsePromise, 'director_plan');
      let plan = (response as { finalOutput?: FinanceDirectorPlan }).finalOutput;
      await drainAgentStream(response, this.options.logger);
      if (!plan) {
        plan = (response as { finalOutput?: FinanceDirectorPlan }).finalOutput;
      }
      if (!plan) {
        throw new Error('director_plan_missing_output');
      }
      validateDirectorPlanBudget(plan, this.options.logger);

      this.recordAudit({
        event: 'director_plan',
        actor: 'director',
        outcome: 'success',
        orgId: parsed.session.orgId,
        sessionId: parsed.session.id,
        metadata: { objective: parsed.objective },
      });

      return plan;
    } catch (error) {
      await Promise.resolve(this.options.onLLMError?.('director_plan', error));
      this.options.logger?.error?.(
        {
          err: error instanceof Error ? error.message : error,
          sessionId: parsed.session.id,
          objective: parsed.objective,
        },
        'director_plan_failed',
      );
      this.recordAudit({
        event: 'director_plan',
        actor: 'director',
        outcome: 'error',
        orgId: parsed.session.orgId,
        sessionId: parsed.session.id,
        detail: error instanceof Error ? error.message : 'director_plan_failed',
      });
      throw error instanceof Error ? error : new Error('director_plan_failed');
    }
  }

  async runSafetyAssessment(input: SafetyAssessmentInput): Promise<SafetyAssessmentWithFilters> {
    const parsed = SafetyAssessmentInputSchema.parse(input);
    const { envelope } = parsed;

    const gateDecision = await applyPolicyGates(this.options.policyGates, {
      stage: 'safety',
      orgId: envelope.session.orgId,
      session: envelope.session,
      command: envelope.command,
      job: envelope.job,
    }, this.options.logger);

    if (gateDecision?.action === 'block') {
      const result = mapFilterToAssessment({
        action: 'block',
        reasons: [gateDecision.reason ?? 'policy_gate_blocked'],
      });
      this.recordAudit({
        event: 'policy_gate',
        actor: 'kernel',
        outcome: 'blocked',
        orgId: envelope.session.orgId,
        sessionId: envelope.session.id,
        detail: gateDecision.reason ?? 'policy_gate_blocked',
        metadata: gateDecision.metadata,
      });
      return { result, appliedFilters: [mapAssessmentToDecision(result)] };
    }

    const preFilters = await this.applyFilters(this.options.preSafetyFilters, {
      phase: 'pre',
      envelope,
    });

    const blockingPre = preFilters.find(shouldShortCircuit);
    if (blockingPre) {
      const result = mapFilterToAssessment(blockingPre);
      this.recordAudit({
        event: 'safety_filter',
        actor: 'safety',
        outcome: result.status === 'approved' ? 'success' : result.status === 'needs_hitl' ? 'needs_hitl' : 'blocked',
        orgId: envelope.session.orgId,
        sessionId: envelope.session.id,
        detail: blockingPre.reasons?.[0],
        metadata: blockingPre.metadata,
      });
      return { result, appliedFilters: preFilters };
    }

    const agent = this.getSafetyAgent();

    try {
      const payload = {
        session: envelope.session,
        command: envelope.command,
        job: envelope.job,
      };
      const responsePromise = runAgent(agent, `${SAFETY_INSTRUCTIONS}\n\n${JSON.stringify(payload)}`, {
        model: this.options.model,
        metadata: {
          orgId: envelope.session.orgId,
          sessionId: envelope.session.id,
          commandId: envelope.command.id,
          kind: 'safety_review',
        },
      } as any);

      const response = await this.runWithTimeout(responsePromise, 'safety_review');
      let review = (response as { finalOutput?: FinanceSafetyReview }).finalOutput;
      await drainAgentStream(response, this.options.logger);
      if (!review) {
        review = (response as { finalOutput?: FinanceSafetyReview }).finalOutput;
      }
      if (!review) {
        throw new Error('safety_review_missing_output');
      }

      const parsedReview = FinanceSafetyReviewSchema.parse(review);
      const decision = parsedReview.decision;
      const refusalReasons = parsedReview.refusal ? [parsedReview.refusal.reason] : [];
      const reasons = [...decision.reasons, ...refusalReasons];
      const mitigations = decision.mitigations;

      let assessment: SafetyAssessmentResult;
      if (parsedReview.refusal || decision.status === 'rejected') {
        assessment = { status: 'rejected', reasons, mitigations };
      } else if (decision.status === 'needs_hitl' || decision.hitlRequired) {
        assessment = { status: 'needs_hitl', reasons, mitigations };
      } else {
        assessment = { status: 'approved', reasons, mitigations };
      }

      const postFilters = await this.applyFilters(this.options.postSafetyFilters, {
        phase: 'post',
        envelope,
        result: assessment,
      });

      const blockingPost = postFilters.find(shouldShortCircuit);
      if (blockingPost) {
        const result = mapFilterToAssessment(blockingPost);
        this.recordAudit({
          event: 'safety_filter',
          actor: 'safety',
          outcome: result.status === 'approved' ? 'success' : result.status === 'needs_hitl' ? 'needs_hitl' : 'blocked',
          orgId: envelope.session.orgId,
          sessionId: envelope.session.id,
          detail: blockingPost.reasons?.[0],
          metadata: blockingPost.metadata,
        });
        return { result, appliedFilters: [...preFilters, ...postFilters] };
      }

      this.recordAudit({
        event: 'safety_assessment',
        actor: 'safety',
        outcome:
          assessment.status === 'approved'
            ? 'success'
            : assessment.status === 'needs_hitl'
              ? 'needs_hitl'
              : 'blocked',
        orgId: envelope.session.orgId,
        sessionId: envelope.session.id,
        metadata: {
          commandId: envelope.command.id,
          jobId: envelope.job.id,
          status: assessment.status,
        },
      });

      return { result: assessment, appliedFilters: [...preFilters, ...postFilters, mapAssessmentToDecision(assessment)] };
    } catch (error) {
      await Promise.resolve(this.options.onLLMError?.('safety_review', error));
      this.options.logger?.error?.(
        {
          err: error instanceof Error ? error.message : error,
          sessionId: envelope.session.id,
          commandId: envelope.command.id,
        },
        'safety_review_failed',
      );
      this.recordAudit({
        event: 'safety_assessment',
        actor: 'safety',
        outcome: 'error',
        orgId: envelope.session.orgId,
        sessionId: envelope.session.id,
        detail: error instanceof Error ? error.message : 'safety_assessment_failed',
      });
      return {
        result: {
          status: 'needs_hitl',
          reasons: ['Safety agent failure, escalate to human'],
        },
        appliedFilters: [...preFilters, { action: 'needs_hitl', reasons: ['safety_review_failed'] }],
      };
    }
  }
}

export type { AgentKernelOptions } from './types.js';
export type { SafetyAssessmentWithFilters } from './types.js';
