import { z } from 'zod';
import type { OrchestratorCommandEnvelope } from './orchestrator.js';
export declare const financeCommandIntentSchema: z.ZodEnum<["tax.prepare_filing", "tax.respond_audit", "tax.check_deadline", "ap.process_invoice", "ap.schedule_payment", "audit.prepare_walkthrough", "audit.update_pbc", "risk.update_register", "risk.assess_control", "cfo.generate_board_pack", "cfo.run_scenario", "regulatory.prepare_filing", "regulatory.track_deadline"]>;
export type FinanceCommandIntent = z.infer<typeof financeCommandIntentSchema>;
export declare const financeDomainKeySchema: z.ZodEnum<["tax_compliance", "accounts_payable", "audit_assurance", "cfo_strategy", "risk_controls", "regulatory_filings"]>;
export type FinanceDomainKey = z.infer<typeof financeDomainKeySchema>;
export declare const financeCommandPayloadSchema: z.ZodObject<{
    intent: z.ZodEnum<["tax.prepare_filing", "tax.respond_audit", "tax.check_deadline", "ap.process_invoice", "ap.schedule_payment", "audit.prepare_walkthrough", "audit.update_pbc", "risk.update_register", "risk.assess_control", "cfo.generate_board_pack", "cfo.run_scenario", "regulatory.prepare_filing", "regulatory.track_deadline"]>;
    domain: z.ZodEnum<["tax_compliance", "accounts_payable", "audit_assurance", "cfo_strategy", "risk_controls", "regulatory_filings"]>;
    objective: z.ZodString;
    inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    guardrails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    telemetry: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    connectors: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        required: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodEnum<["active", "pending", "inactive", "error"]>>;
    }, "strip", z.ZodTypeAny, {
        status?: "active" | "pending" | "inactive" | "error" | undefined;
        required?: boolean | undefined;
    }, {
        status?: "active" | "pending" | "inactive" | "error" | undefined;
        required?: boolean | undefined;
    }>>>;
    safety: z.ZodOptional<z.ZodObject<{
        riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
        rationale: z.ZodOptional<z.ZodString>;
        requiredMitigations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        riskLevel: "low" | "medium" | "high";
        rationale?: string | undefined;
        requiredMitigations?: string[] | undefined;
    }, {
        riskLevel?: "low" | "medium" | "high" | undefined;
        rationale?: string | undefined;
        requiredMitigations?: string[] | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
    intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
    objective: string;
    inputs: Record<string, unknown>;
    guardrails: string[];
    telemetry: string[];
    connectors: Record<string, {
        status?: "active" | "pending" | "inactive" | "error" | undefined;
        required?: boolean | undefined;
    }>;
    safety?: {
        riskLevel: "low" | "medium" | "high";
        rationale?: string | undefined;
        requiredMitigations?: string[] | undefined;
    } | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
    intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
    objective: string;
    safety?: {
        riskLevel?: "low" | "medium" | "high" | undefined;
        rationale?: string | undefined;
        requiredMitigations?: string[] | undefined;
    } | undefined;
    inputs?: Record<string, unknown> | undefined;
    guardrails?: string[] | undefined;
    telemetry?: string[] | undefined;
    connectors?: Record<string, {
        status?: "active" | "pending" | "inactive" | "error" | undefined;
        required?: boolean | undefined;
    }> | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export type FinanceCommandPayload = z.infer<typeof financeCommandPayloadSchema>;
export declare const financeCommandResultSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["completed", "failed", "needs_hitl"]>>;
    output: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    notices: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    followUps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        domain: z.ZodEnum<["tax_compliance", "accounts_payable", "audit_assurance", "cfo_strategy", "risk_controls", "regulatory_filings"]>;
        objective: z.ZodString;
        inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        guardrails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        telemetry: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        connectors: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            required: z.ZodOptional<z.ZodBoolean>;
            status: z.ZodOptional<z.ZodEnum<["active", "pending", "inactive", "error"]>>;
        }, "strip", z.ZodTypeAny, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
            rationale: z.ZodOptional<z.ZodString>;
            requiredMitigations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            riskLevel: "low" | "medium" | "high";
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        }, {
            riskLevel?: "low" | "medium" | "high" | undefined;
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        }>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        intent: z.ZodEnum<["tax.prepare_filing", "tax.respond_audit", "tax.check_deadline", "ap.process_invoice", "ap.schedule_payment", "audit.prepare_walkthrough", "audit.update_pbc", "risk.update_register", "risk.assess_control", "cfo.generate_board_pack", "cfo.run_scenario", "regulatory.prepare_filing", "regulatory.track_deadline"]>;
    }, "strip", z.ZodTypeAny, {
        domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
        intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
        objective: string;
        inputs: Record<string, unknown>;
        guardrails: string[];
        telemetry: string[];
        connectors: Record<string, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }>;
        safety?: {
            riskLevel: "low" | "medium" | "high";
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        } | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
        intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
        objective: string;
        safety?: {
            riskLevel?: "low" | "medium" | "high" | undefined;
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        } | undefined;
        inputs?: Record<string, unknown> | undefined;
        guardrails?: string[] | undefined;
        telemetry?: string[] | undefined;
        connectors?: Record<string, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }> | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">>;
    telemetry: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString]>>>;
    errorCode: z.ZodOptional<z.ZodString>;
    hitlReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notices: string[];
    followUps: {
        domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
        intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
        objective: string;
        inputs: Record<string, unknown>;
        guardrails: string[];
        telemetry: string[];
        connectors: Record<string, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }>;
        safety?: {
            riskLevel: "low" | "medium" | "high";
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        } | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    status?: "failed" | "completed" | "needs_hitl" | undefined;
    telemetry?: Record<string, string | number> | undefined;
    output?: Record<string, unknown> | undefined;
    errorCode?: string | undefined;
    hitlReason?: string | undefined;
}, {
    status?: "failed" | "completed" | "needs_hitl" | undefined;
    telemetry?: Record<string, string | number> | undefined;
    output?: Record<string, unknown> | undefined;
    notices?: string[] | undefined;
    followUps?: {
        domain: "tax_compliance" | "accounts_payable" | "audit_assurance" | "cfo_strategy" | "risk_controls" | "regulatory_filings";
        intent: "tax.prepare_filing" | "tax.respond_audit" | "tax.check_deadline" | "ap.process_invoice" | "ap.schedule_payment" | "audit.prepare_walkthrough" | "audit.update_pbc" | "risk.update_register" | "risk.assess_control" | "cfo.generate_board_pack" | "cfo.run_scenario" | "regulatory.prepare_filing" | "regulatory.track_deadline";
        objective: string;
        safety?: {
            riskLevel?: "low" | "medium" | "high" | undefined;
            rationale?: string | undefined;
            requiredMitigations?: string[] | undefined;
        } | undefined;
        inputs?: Record<string, unknown> | undefined;
        guardrails?: string[] | undefined;
        telemetry?: string[] | undefined;
        connectors?: Record<string, {
            status?: "active" | "pending" | "inactive" | "error" | undefined;
            required?: boolean | undefined;
        }> | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
    errorCode?: string | undefined;
    hitlReason?: string | undefined;
}>;
export type FinanceCommandResult = z.infer<typeof financeCommandResultSchema>;
export interface FinanceWorkerEnvelope extends OrchestratorCommandEnvelope {
    command: OrchestratorCommandEnvelope['command'] & {
        payload: FinanceCommandPayload;
    };
}
//# sourceMappingURL=orchestrator-mcp.d.ts.map