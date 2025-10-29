type FinanceDomainAgentKey = 'tax_compliance' | 'accounts_payable' | 'audit_assurance' | 'cfo_strategy' | 'risk_controls' | 'regulatory_filings';
type FinanceCapabilityManifest = {
    version: string;
    director: Record<string, unknown>;
    domains: Array<{
        key: FinanceDomainAgentKey | string;
        description?: string;
        displayName?: string;
        instructions?: string;
        tools?: Array<Record<string, unknown>>;
        datasets?: Array<Record<string, unknown>>;
        connectors: Array<{
            type: string;
            name: string;
            purpose?: string;
            optional?: boolean;
        }>;
        guardrails?: Array<Record<string, unknown>>;
        telemetry?: string[];
        hitlPolicies?: string[];
    }>;
};
export declare function getFinanceCapabilityManifest(version?: string): FinanceCapabilityManifest;
export {};
//# sourceMappingURL=finance-manifest.d.ts.map