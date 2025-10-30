import { z } from 'zod';
export declare const FinanceHitlRequirementSchema: z.ZodObject<{
    required: z.ZodBoolean;
    reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    reviewer: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    required: boolean;
    reasons: string[];
    mitigations: string[];
    reviewer?: string | undefined;
}, {
    required: boolean;
    reasons?: string[] | undefined;
    mitigations?: string[] | undefined;
    reviewer?: string | undefined;
}>;
export declare const FinanceCommandBudgetSchema: z.ZodObject<{
    tokens: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    notes?: string | undefined;
    tokens?: number | undefined;
    currency?: string | undefined;
    amount?: number | undefined;
}, {
    notes?: string | undefined;
    tokens?: number | undefined;
    currency?: string | undefined;
    amount?: number | undefined;
}>;
export declare const FinanceCommandEnvelopeSchema: z.ZodObject<{
    worker: z.ZodEnum<["director", "domain", "safety"]>;
    commandType: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    domain: z.ZodOptional<z.ZodString>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    successCriteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    connectorDependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    telemetry: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    guardrails: z.ZodDefault<z.ZodObject<{
        safetyPolicies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        residency: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        residency: string[];
        safetyPolicies: string[];
    }, {
        residency?: string[] | undefined;
        safetyPolicies?: string[] | undefined;
    }>>;
    hitl: z.ZodOptional<z.ZodObject<{
        required: z.ZodBoolean;
        reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reviewer: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        required: boolean;
        reasons: string[];
        mitigations: string[];
        reviewer?: string | undefined;
    }, {
        required: boolean;
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        reviewer?: string | undefined;
    }>>;
    budget: z.ZodOptional<z.ZodObject<{
        tokens: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        notes?: string | undefined;
        tokens?: number | undefined;
        currency?: string | undefined;
        amount?: number | undefined;
    }, {
        notes?: string | undefined;
        tokens?: number | undefined;
        currency?: string | undefined;
        amount?: number | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    title: string;
    description: string;
    guardrails: {
        residency: string[];
        safetyPolicies: string[];
    };
    worker: "director" | "domain" | "safety";
    commandType: string;
    payload: Record<string, unknown>;
    successCriteria: string[];
    dependencies: string[];
    connectorDependencies: string[];
    telemetry: string[];
    domain?: string | undefined;
    hitl?: {
        required: boolean;
        reasons: string[];
        mitigations: string[];
        reviewer?: string | undefined;
    } | undefined;
    budget?: {
        notes?: string | undefined;
        tokens?: number | undefined;
        currency?: string | undefined;
        amount?: number | undefined;
    } | undefined;
}, {
    title: string;
    description: string;
    worker: "director" | "domain" | "safety";
    commandType: string;
    guardrails?: {
        residency?: string[] | undefined;
        safetyPolicies?: string[] | undefined;
    } | undefined;
    domain?: string | undefined;
    payload?: Record<string, unknown> | undefined;
    successCriteria?: string[] | undefined;
    dependencies?: string[] | undefined;
    connectorDependencies?: string[] | undefined;
    telemetry?: string[] | undefined;
    hitl?: {
        required: boolean;
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        reviewer?: string | undefined;
    } | undefined;
    budget?: {
        notes?: string | undefined;
        tokens?: number | undefined;
        currency?: string | undefined;
        amount?: number | undefined;
    } | undefined;
}>;
export declare const FinanceDirectorPlanStepSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["pending", "ready", "in_progress", "blocked", "complete"]>;
    envelope: z.ZodObject<{
        worker: z.ZodEnum<["director", "domain", "safety"]>;
        commandType: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        domain: z.ZodOptional<z.ZodString>;
        payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        successCriteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        connectorDependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        telemetry: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        guardrails: z.ZodDefault<z.ZodObject<{
            safetyPolicies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            residency: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            residency: string[];
            safetyPolicies: string[];
        }, {
            residency?: string[] | undefined;
            safetyPolicies?: string[] | undefined;
        }>>;
        hitl: z.ZodOptional<z.ZodObject<{
            required: z.ZodBoolean;
            reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            reviewer: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        }, {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        }>>;
        budget: z.ZodOptional<z.ZodObject<{
            tokens: z.ZodOptional<z.ZodNumber>;
            currency: z.ZodOptional<z.ZodString>;
            amount: z.ZodOptional<z.ZodNumber>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        }, {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        title: string;
        description: string;
        guardrails: {
            residency: string[];
            safetyPolicies: string[];
        };
        worker: "director" | "domain" | "safety";
        commandType: string;
        payload: Record<string, unknown>;
        successCriteria: string[];
        dependencies: string[];
        connectorDependencies: string[];
        telemetry: string[];
        domain?: string | undefined;
        hitl?: {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        } | undefined;
        budget?: {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        } | undefined;
    }, {
        title: string;
        description: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        guardrails?: {
            residency?: string[] | undefined;
            safetyPolicies?: string[] | undefined;
        } | undefined;
        domain?: string | undefined;
        payload?: Record<string, unknown> | undefined;
        successCriteria?: string[] | undefined;
        dependencies?: string[] | undefined;
        connectorDependencies?: string[] | undefined;
        telemetry?: string[] | undefined;
        hitl?: {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        } | undefined;
        budget?: {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        } | undefined;
    }>;
    notes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
    notes: string[];
    id: string;
    envelope: {
        title: string;
        description: string;
        guardrails: {
            residency: string[];
            safetyPolicies: string[];
        };
        worker: "director" | "domain" | "safety";
        commandType: string;
        payload: Record<string, unknown>;
        successCriteria: string[];
        dependencies: string[];
        connectorDependencies: string[];
        telemetry: string[];
        domain?: string | undefined;
        hitl?: {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        } | undefined;
        budget?: {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        } | undefined;
    };
}, {
    status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
    id: string;
    envelope: {
        title: string;
        description: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        guardrails?: {
            residency?: string[] | undefined;
            safetyPolicies?: string[] | undefined;
        } | undefined;
        domain?: string | undefined;
        payload?: Record<string, unknown> | undefined;
        successCriteria?: string[] | undefined;
        dependencies?: string[] | undefined;
        connectorDependencies?: string[] | undefined;
        telemetry?: string[] | undefined;
        hitl?: {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        } | undefined;
        budget?: {
            notes?: string | undefined;
            tokens?: number | undefined;
            currency?: string | undefined;
            amount?: number | undefined;
        } | undefined;
    };
    notes?: string[] | undefined;
}>;
export declare const FinanceDirectorPlanSchema: z.ZodObject<{
    version: z.ZodString;
    objective: z.ZodString;
    summary: z.ZodString;
    decisionLog: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["pending", "ready", "in_progress", "blocked", "complete"]>;
        envelope: z.ZodObject<{
            worker: z.ZodEnum<["director", "domain", "safety"]>;
            commandType: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            domain: z.ZodOptional<z.ZodString>;
            payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            successCriteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            connectorDependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            telemetry: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            guardrails: z.ZodDefault<z.ZodObject<{
                safetyPolicies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                residency: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strict", z.ZodTypeAny, {
                residency: string[];
                safetyPolicies: string[];
            }, {
                residency?: string[] | undefined;
                safetyPolicies?: string[] | undefined;
            }>>;
            hitl: z.ZodOptional<z.ZodObject<{
                required: z.ZodBoolean;
                reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                reviewer: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                required: boolean;
                reasons: string[];
                mitigations: string[];
                reviewer?: string | undefined;
            }, {
                required: boolean;
                reasons?: string[] | undefined;
                mitigations?: string[] | undefined;
                reviewer?: string | undefined;
            }>>;
            budget: z.ZodOptional<z.ZodObject<{
                tokens: z.ZodOptional<z.ZodNumber>;
                currency: z.ZodOptional<z.ZodString>;
                amount: z.ZodOptional<z.ZodNumber>;
                notes: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            }, {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            }>>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            description: string;
            guardrails: {
                residency: string[];
                safetyPolicies: string[];
            };
            worker: "director" | "domain" | "safety";
            commandType: string;
            payload: Record<string, unknown>;
            successCriteria: string[];
            dependencies: string[];
            connectorDependencies: string[];
            telemetry: string[];
            domain?: string | undefined;
            hitl?: {
                required: boolean;
                reasons: string[];
                mitigations: string[];
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        }, {
            title: string;
            description: string;
            worker: "director" | "domain" | "safety";
            commandType: string;
            guardrails?: {
                residency?: string[] | undefined;
                safetyPolicies?: string[] | undefined;
            } | undefined;
            domain?: string | undefined;
            payload?: Record<string, unknown> | undefined;
            successCriteria?: string[] | undefined;
            dependencies?: string[] | undefined;
            connectorDependencies?: string[] | undefined;
            telemetry?: string[] | undefined;
            hitl?: {
                required: boolean;
                reasons?: string[] | undefined;
                mitigations?: string[] | undefined;
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        }>;
        notes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
        notes: string[];
        id: string;
        envelope: {
            title: string;
            description: string;
            guardrails: {
                residency: string[];
                safetyPolicies: string[];
            };
            worker: "director" | "domain" | "safety";
            commandType: string;
            payload: Record<string, unknown>;
            successCriteria: string[];
            dependencies: string[];
            connectorDependencies: string[];
            telemetry: string[];
            domain?: string | undefined;
            hitl?: {
                required: boolean;
                reasons: string[];
                mitigations: string[];
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        };
    }, {
        status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
        id: string;
        envelope: {
            title: string;
            description: string;
            worker: "director" | "domain" | "safety";
            commandType: string;
            guardrails?: {
                residency?: string[] | undefined;
                safetyPolicies?: string[] | undefined;
            } | undefined;
            domain?: string | undefined;
            payload?: Record<string, unknown> | undefined;
            successCriteria?: string[] | undefined;
            dependencies?: string[] | undefined;
            connectorDependencies?: string[] | undefined;
            telemetry?: string[] | undefined;
            hitl?: {
                required: boolean;
                reasons?: string[] | undefined;
                mitigations?: string[] | undefined;
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        };
        notes?: string[] | undefined;
    }>, "many">;
    globalHitl: z.ZodOptional<z.ZodObject<{
        required: z.ZodBoolean;
        reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reviewer: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        required: boolean;
        reasons: string[];
        mitigations: string[];
        reviewer?: string | undefined;
    }, {
        required: boolean;
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        reviewer?: string | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    summary: string;
    steps: {
        status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
        notes: string[];
        id: string;
        envelope: {
            title: string;
            description: string;
            guardrails: {
                residency: string[];
                safetyPolicies: string[];
            };
            worker: "director" | "domain" | "safety";
            commandType: string;
            payload: Record<string, unknown>;
            successCriteria: string[];
            dependencies: string[];
            connectorDependencies: string[];
            telemetry: string[];
            domain?: string | undefined;
            hitl?: {
                required: boolean;
                reasons: string[];
                mitigations: string[];
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        };
    }[];
    version: string;
    objective: string;
    decisionLog: string[];
    globalHitl?: {
        required: boolean;
        reasons: string[];
        mitigations: string[];
        reviewer?: string | undefined;
    } | undefined;
}, {
    summary: string;
    steps: {
        status: "pending" | "ready" | "in_progress" | "blocked" | "complete";
        id: string;
        envelope: {
            title: string;
            description: string;
            worker: "director" | "domain" | "safety";
            commandType: string;
            guardrails?: {
                residency?: string[] | undefined;
                safetyPolicies?: string[] | undefined;
            } | undefined;
            domain?: string | undefined;
            payload?: Record<string, unknown> | undefined;
            successCriteria?: string[] | undefined;
            dependencies?: string[] | undefined;
            connectorDependencies?: string[] | undefined;
            telemetry?: string[] | undefined;
            hitl?: {
                required: boolean;
                reasons?: string[] | undefined;
                mitigations?: string[] | undefined;
                reviewer?: string | undefined;
            } | undefined;
            budget?: {
                notes?: string | undefined;
                tokens?: number | undefined;
                currency?: string | undefined;
                amount?: number | undefined;
            } | undefined;
        };
        notes?: string[] | undefined;
    }[];
    version: string;
    objective: string;
    decisionLog?: string[] | undefined;
    globalHitl?: {
        required: boolean;
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        reviewer?: string | undefined;
    } | undefined;
}>;
export declare const FinanceSafetyDecisionSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "needs_hitl", "rejected"]>;
    reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    hitlRequired: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    status: "approved" | "rejected" | "needs_hitl";
    reasons: string[];
    mitigations: string[];
    hitlRequired: boolean;
}, {
    status: "approved" | "rejected" | "needs_hitl";
    reasons?: string[] | undefined;
    mitigations?: string[] | undefined;
    hitlRequired?: boolean | undefined;
}>;
export declare const FinanceSafetyReviewSchema: z.ZodObject<{
    command: z.ZodObject<{
        id: z.ZodString;
        worker: z.ZodEnum<["director", "domain", "safety"]>;
        commandType: z.ZodString;
        payloadFingerprint: z.ZodString;
        hitl: z.ZodOptional<z.ZodObject<{
            required: z.ZodBoolean;
            reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            reviewer: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        }, {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        payloadFingerprint: string;
        hitl?: {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        } | undefined;
    }, {
        id: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        payloadFingerprint: string;
        hitl?: {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        } | undefined;
    }>;
    envelope: z.ZodObject<{
        sessionId: z.ZodString;
        orgId: z.ZodString;
        jobId: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        orgId: string;
        jobId?: string | undefined;
    }, {
        sessionId: string;
        orgId: string;
        jobId?: string | undefined;
    }>;
    decision: z.ZodObject<{
        status: z.ZodEnum<["approved", "needs_hitl", "rejected"]>;
        reasons: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        mitigations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        hitlRequired: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        status: "approved" | "rejected" | "needs_hitl";
        reasons: string[];
        mitigations: string[];
        hitlRequired: boolean;
    }, {
        status: "approved" | "rejected" | "needs_hitl";
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        hitlRequired?: boolean | undefined;
    }>;
    refusal: z.ZodOptional<z.ZodObject<{
        reason: z.ZodString;
        policy: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        reason: string;
        policy?: string | undefined;
    }, {
        reason: string;
        policy?: string | undefined;
    }>>;
    audit: z.ZodOptional<z.ZodObject<{
        reviewer: z.ZodOptional<z.ZodString>;
        reviewedAt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        reviewer?: string | undefined;
        reviewedAt?: string | undefined;
    }, {
        reviewer?: string | undefined;
        reviewedAt?: string | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    envelope: {
        sessionId: string;
        orgId: string;
        jobId?: string | undefined;
    };
    command: {
        id: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        payloadFingerprint: string;
        hitl?: {
            required: boolean;
            reasons: string[];
            mitigations: string[];
            reviewer?: string | undefined;
        } | undefined;
    };
    decision: {
        status: "approved" | "rejected" | "needs_hitl";
        reasons: string[];
        mitigations: string[];
        hitlRequired: boolean;
    };
    refusal?: {
        reason: string;
        policy?: string | undefined;
    } | undefined;
    audit?: {
        reviewer?: string | undefined;
        reviewedAt?: string | undefined;
    } | undefined;
}, {
    envelope: {
        sessionId: string;
        orgId: string;
        jobId?: string | undefined;
    };
    command: {
        id: string;
        worker: "director" | "domain" | "safety";
        commandType: string;
        payloadFingerprint: string;
        hitl?: {
            required: boolean;
            reasons?: string[] | undefined;
            mitigations?: string[] | undefined;
            reviewer?: string | undefined;
        } | undefined;
    };
    decision: {
        status: "approved" | "rejected" | "needs_hitl";
        reasons?: string[] | undefined;
        mitigations?: string[] | undefined;
        hitlRequired?: boolean | undefined;
    };
    refusal?: {
        reason: string;
        policy?: string | undefined;
    } | undefined;
    audit?: {
        reviewer?: string | undefined;
        reviewedAt?: string | undefined;
    } | undefined;
}>;
export type FinanceHitlRequirement = z.infer<typeof FinanceHitlRequirementSchema>;
export type FinanceCommandEnvelope = z.infer<typeof FinanceCommandEnvelopeSchema>;
export type FinanceDirectorPlanStep = z.infer<typeof FinanceDirectorPlanStepSchema>;
export type FinanceDirectorPlan = z.infer<typeof FinanceDirectorPlanSchema>;
export type FinanceSafetyDecision = z.infer<typeof FinanceSafetyDecisionSchema>;
export type FinanceSafetyReview = z.infer<typeof FinanceSafetyReviewSchema>;
//# sourceMappingURL=orchestrator-schemas.d.ts.map