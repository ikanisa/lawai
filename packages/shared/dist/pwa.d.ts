import { z } from 'zod';
export declare const AgentRunStatusSchema: z.ZodEnum<["queued", "running", "succeeded", "failed", "requires_hitl"]>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export declare const WebSearchModeSchema: z.ZodEnum<["allowlist", "broad", "disabled"]>;
export type WebSearchMode = z.infer<typeof WebSearchModeSchema>;
export declare const AgentRunSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    threadId: z.ZodString;
    status: z.ZodEnum<["queued", "running", "succeeded", "failed", "requires_hitl"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    input: z.ZodString;
    jurisdiction: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    policyFlags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    webSearchMode: z.ZodDefault<z.ZodEnum<["allowlist", "broad", "disabled"]>>;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "queued" | "running" | "succeeded" | "requires_hitl";
    jurisdiction: string | null;
    id: string;
    agentId: string;
    threadId: string;
    createdAt: string;
    updatedAt: string;
    input: string;
    policyFlags: string[];
    webSearchMode: "allowlist" | "broad" | "disabled";
}, {
    status: "failed" | "queued" | "running" | "succeeded" | "requires_hitl";
    id: string;
    agentId: string;
    threadId: string;
    createdAt: string;
    updatedAt: string;
    input: string;
    jurisdiction?: string | null | undefined;
    policyFlags?: string[] | undefined;
    webSearchMode?: "allowlist" | "broad" | "disabled" | undefined;
}>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export declare const ToolEventSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["running", "success", "error"]>;
    detail: z.ZodString;
    planStepId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    startedAt: z.ZodString;
    completedAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "success" | "running" | "error";
    id: string;
    name: string;
    detail: string;
    startedAt: string;
    planStepId?: string | null | undefined;
    completedAt?: string | null | undefined;
}, {
    status: "success" | "running" | "error";
    id: string;
    name: string;
    detail: string;
    startedAt: string;
    planStepId?: string | null | undefined;
    completedAt?: string | null | undefined;
}>;
export type ToolEvent = z.infer<typeof ToolEventSchema>;
export declare const AgentRunRequestSchema: z.ZodObject<{
    input: z.ZodString;
    agent_id: z.ZodString;
    tools_enabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    jurisdiction: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    policy_flags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    web_search_mode: z.ZodDefault<z.ZodEnum<["allowlist", "broad", "disabled"]>>;
}, "strict", z.ZodTypeAny, {
    input: string;
    agent_id: string;
    tools_enabled: string[];
    policy_flags: string[];
    web_search_mode: "allowlist" | "broad" | "disabled";
    jurisdiction?: string | null | undefined;
}, {
    input: string;
    agent_id: string;
    jurisdiction?: string | null | undefined;
    tools_enabled?: string[] | undefined;
    policy_flags?: string[] | undefined;
    web_search_mode?: "allowlist" | "broad" | "disabled" | undefined;
}>;
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;
export declare const AgentStreamRequestSchema: z.ZodObject<{
    input: z.ZodString;
    agent_id: z.ZodString;
    run_id: z.ZodString;
    thread_id: z.ZodString;
    tools_enabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    input: string;
    agent_id: string;
    tools_enabled: string[];
    run_id: string;
    thread_id: string;
}, {
    input: string;
    agent_id: string;
    run_id: string;
    thread_id: string;
    tools_enabled?: string[] | undefined;
}>;
export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;
export declare const VoiceSessionTokenSchema: z.ZodObject<{
    token: z.ZodString;
    expires_at: z.ZodString;
    websocket_url: z.ZodOptional<z.ZodString>;
    webrtc_url: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    token: string;
    expires_at: string;
    websocket_url?: string | undefined;
    webrtc_url?: string | undefined;
}, {
    token: string;
    expires_at: string;
    websocket_url?: string | undefined;
    webrtc_url?: string | undefined;
}>;
export type VoiceSessionToken = z.infer<typeof VoiceSessionTokenSchema>;
export declare const ResearchRiskLevelSchema: z.ZodEnum<["LOW", "MED", "HIGH"]>;
export type ResearchRiskLevel = z.infer<typeof ResearchRiskLevelSchema>;
export declare const ResearchPlanStepSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    tool: z.ZodString;
    status: z.ZodEnum<["done", "active", "pending"]>;
    summary: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "active" | "pending" | "done";
    title: string;
    id: string;
    tool: string;
    summary: string;
}, {
    status: "active" | "pending" | "done";
    title: string;
    id: string;
    tool: string;
    summary: string;
}>;
export type ResearchPlanStep = z.infer<typeof ResearchPlanStepSchema>;
export declare const ResearchPlanSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    jurisdiction: z.ZodString;
    riskLevel: z.ZodEnum<["LOW", "MED", "HIGH"]>;
    riskSummary: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        tool: z.ZodString;
        status: z.ZodEnum<["done", "active", "pending"]>;
        summary: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        status: "active" | "pending" | "done";
        title: string;
        id: string;
        tool: string;
        summary: string;
    }, {
        status: "active" | "pending" | "done";
        title: string;
        id: string;
        tool: string;
        summary: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    jurisdiction: string;
    title: string;
    riskLevel: "LOW" | "HIGH" | "MED";
    id: string;
    riskSummary: string;
    steps: {
        status: "active" | "pending" | "done";
        title: string;
        id: string;
        tool: string;
        summary: string;
    }[];
}, {
    jurisdiction: string;
    title: string;
    riskLevel: "LOW" | "HIGH" | "MED";
    id: string;
    riskSummary: string;
    steps: {
        status: "active" | "pending" | "done";
        title: string;
        id: string;
        tool: string;
        summary: string;
    }[];
}>;
export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export declare const ResearchFilterOptionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    id: string;
    label: string;
    description?: string | undefined;
}, {
    id: string;
    label: string;
    description?: string | undefined;
}>;
export type ResearchFilterOption = z.infer<typeof ResearchFilterOptionSchema>;
export declare const ResearchCitationSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    href: z.ZodString;
    type: z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>;
    snippet: z.ZodString;
    score: z.ZodNumber;
    date: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
    date: string;
    id: string;
    label: string;
    href: string;
    snippet: string;
    score: number;
}, {
    type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
    date: string;
    id: string;
    label: string;
    href: string;
    snippet: string;
    score: number;
}>;
export type ResearchCitation = z.infer<typeof ResearchCitationSchema>;
export declare const ResearchDeskContextSchema: z.ZodObject<{
    plan: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        jurisdiction: z.ZodString;
        riskLevel: z.ZodEnum<["LOW", "MED", "HIGH"]>;
        riskSummary: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            tool: z.ZodString;
            status: z.ZodEnum<["done", "active", "pending"]>;
            summary: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }, {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        jurisdiction: string;
        title: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        id: string;
        riskSummary: string;
        steps: {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }[];
    }, {
        jurisdiction: string;
        title: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        id: string;
        riskSummary: string;
        steps: {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }[];
    }>;
    filters: z.ZodObject<{
        publicationDates: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            id: string;
            label: string;
            description?: string | undefined;
        }, {
            id: string;
            label: string;
            description?: string | undefined;
        }>, "many">;
        entryIntoForce: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            id: string;
            label: string;
            description?: string | undefined;
        }, {
            id: string;
            label: string;
            description?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        publicationDates: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
        entryIntoForce: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
    }, {
        publicationDates: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
        entryIntoForce: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
    }>;
    defaultCitations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        href: z.ZodString;
        type: z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>;
        snippet: z.ZodString;
        score: z.ZodNumber;
        date: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }, {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }>, "many">;
    suggestions: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    plan: {
        jurisdiction: string;
        title: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        id: string;
        riskSummary: string;
        steps: {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }[];
    };
    filters: {
        publicationDates: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
        entryIntoForce: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
    };
    defaultCitations: {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }[];
    suggestions: string[];
}, {
    plan: {
        jurisdiction: string;
        title: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        id: string;
        riskSummary: string;
        steps: {
            status: "active" | "pending" | "done";
            title: string;
            id: string;
            tool: string;
            summary: string;
        }[];
    };
    filters: {
        publicationDates: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
        entryIntoForce: {
            id: string;
            label: string;
            description?: string | undefined;
        }[];
    };
    defaultCitations: {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }[];
    suggestions: string[];
}>;
export type ResearchDeskContext = z.infer<typeof ResearchDeskContextSchema>;
export declare const ResearchStreamPayloadSchema: z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
    tool: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["running", "success", "error"]>;
        detail: z.ZodString;
        planStepId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "success" | "running" | "error";
        id: string;
        name: string;
        detail: string;
        planStepId?: string | null | undefined;
    }, {
        status: "success" | "running" | "error";
        id: string;
        name: string;
        detail: string;
        planStepId?: string | null | undefined;
    }>>;
    citation: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        href: z.ZodString;
        type: z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>;
        snippet: z.ZodString;
        score: z.ZodNumber;
        date: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }, {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    }>>;
    risk: z.ZodOptional<z.ZodObject<{
        level: z.ZodEnum<["LOW", "MED", "HIGH"]>;
        summary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        level: "LOW" | "HIGH" | "MED";
        summary: string;
    }, {
        level: "LOW" | "HIGH" | "MED";
        summary: string;
    }>>;
}, "strict", z.ZodTypeAny, {
    citation?: {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    } | undefined;
    risk?: {
        level: "LOW" | "HIGH" | "MED";
        summary: string;
    } | undefined;
    token?: string | undefined;
    tool?: {
        status: "success" | "running" | "error";
        id: string;
        name: string;
        detail: string;
        planStepId?: string | null | undefined;
    } | undefined;
}, {
    citation?: {
        type: "Officiel" | "Consolidé" | "Traduction" | "Jurisprudence";
        date: string;
        id: string;
        label: string;
        href: string;
        snippet: string;
        score: number;
    } | undefined;
    risk?: {
        level: "LOW" | "HIGH" | "MED";
        summary: string;
    } | undefined;
    token?: string | undefined;
    tool?: {
        status: "success" | "running" | "error";
        id: string;
        name: string;
        detail: string;
        planStepId?: string | null | undefined;
    } | undefined;
}>;
export type ResearchStreamPayload = z.infer<typeof ResearchStreamPayloadSchema>;
export type ResearchStreamMessageType = 'token' | 'tool' | 'citation' | 'risk' | 'done';
export interface ResearchStreamEvent {
    type: ResearchStreamMessageType;
    data: ResearchStreamPayload;
}
export declare const CitationTypeSchema: z.ZodEnum<["statute", "regulation", "case", "doctrine"]>;
export type CitationType = z.infer<typeof CitationTypeSchema>;
export declare const CitationVersionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    publishedAt: z.ZodString;
    isConsolidated: z.ZodBoolean;
    diffSummary: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    label: string;
    publishedAt: string;
    isConsolidated: boolean;
    diffSummary: string;
}, {
    id: string;
    label: string;
    publishedAt: string;
    isConsolidated: boolean;
    diffSummary: string;
}>;
export type CitationVersion = z.infer<typeof CitationVersionSchema>;
export declare const CitationDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    eli: z.ZodString;
    jurisdiction: z.ZodString;
    type: z.ZodEnum<["statute", "regulation", "case", "doctrine"]>;
    publicationDate: z.ZodString;
    entryIntoForce: z.ZodString;
    badges: z.ZodArray<z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>, "many">;
    summary: z.ZodString;
    toc: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        anchor: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        anchor: string;
    }, {
        id: string;
        label: string;
        anchor: string;
    }>, "many">;
    versions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        publishedAt: z.ZodString;
        isConsolidated: z.ZodBoolean;
        diffSummary: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        publishedAt: string;
        isConsolidated: boolean;
        diffSummary: string;
    }, {
        id: string;
        label: string;
        publishedAt: string;
        isConsolidated: boolean;
        diffSummary: string;
    }>, "many">;
    metadata: z.ZodRecord<z.ZodString, z.ZodString>;
    content: z.ZodArray<z.ZodObject<{
        anchor: z.ZodString;
        heading: z.ZodString;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        anchor: string;
        text: string;
    }, {
        heading: string;
        anchor: string;
        text: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "statute" | "regulation" | "case" | "doctrine";
    jurisdiction: string;
    title: string;
    metadata: Record<string, string>;
    id: string;
    summary: string;
    entryIntoForce: string;
    eli: string;
    publicationDate: string;
    badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
    toc: {
        id: string;
        label: string;
        anchor: string;
    }[];
    versions: {
        id: string;
        label: string;
        publishedAt: string;
        isConsolidated: boolean;
        diffSummary: string;
    }[];
    content: {
        heading: string;
        anchor: string;
        text: string;
    }[];
}, {
    type: "statute" | "regulation" | "case" | "doctrine";
    jurisdiction: string;
    title: string;
    metadata: Record<string, string>;
    id: string;
    summary: string;
    entryIntoForce: string;
    eli: string;
    publicationDate: string;
    badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
    toc: {
        id: string;
        label: string;
        anchor: string;
    }[];
    versions: {
        id: string;
        label: string;
        publishedAt: string;
        isConsolidated: boolean;
        diffSummary: string;
    }[];
    content: {
        heading: string;
        anchor: string;
        text: string;
    }[];
}>;
export type CitationDocument = z.infer<typeof CitationDocumentSchema>;
export declare const CitationsBrowserDataSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        eli: z.ZodString;
        jurisdiction: z.ZodString;
        type: z.ZodEnum<["statute", "regulation", "case", "doctrine"]>;
        publicationDate: z.ZodString;
        entryIntoForce: z.ZodString;
        badges: z.ZodArray<z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>, "many">;
        summary: z.ZodString;
        toc: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            anchor: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            anchor: string;
        }, {
            id: string;
            label: string;
            anchor: string;
        }>, "many">;
        versions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            publishedAt: z.ZodString;
            isConsolidated: z.ZodBoolean;
            diffSummary: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }, {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }>, "many">;
        metadata: z.ZodRecord<z.ZodString, z.ZodString>;
        content: z.ZodArray<z.ZodObject<{
            anchor: z.ZodString;
            heading: z.ZodString;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            anchor: string;
            text: string;
        }, {
            heading: string;
            anchor: string;
            text: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }>, "many">;
    ohadaFeatured: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        eli: z.ZodString;
        jurisdiction: z.ZodString;
        type: z.ZodEnum<["statute", "regulation", "case", "doctrine"]>;
        publicationDate: z.ZodString;
        entryIntoForce: z.ZodString;
        badges: z.ZodArray<z.ZodEnum<["Officiel", "Consolidé", "Traduction", "Jurisprudence"]>, "many">;
        summary: z.ZodString;
        toc: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            anchor: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            anchor: string;
        }, {
            id: string;
            label: string;
            anchor: string;
        }>, "many">;
        versions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            publishedAt: z.ZodString;
            isConsolidated: z.ZodBoolean;
            diffSummary: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }, {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }>, "many">;
        metadata: z.ZodRecord<z.ZodString, z.ZodString>;
        content: z.ZodArray<z.ZodObject<{
            anchor: z.ZodString;
            heading: z.ZodString;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            anchor: string;
            text: string;
        }, {
            heading: string;
            anchor: string;
            text: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    results: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }[];
    ohadaFeatured: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }[];
}, {
    results: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }[];
    ohadaFeatured: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        metadata: Record<string, string>;
        id: string;
        summary: string;
        entryIntoForce: string;
        eli: string;
        publicationDate: string;
        badges: ("Officiel" | "Consolidé" | "Traduction" | "Jurisprudence")[];
        toc: {
            id: string;
            label: string;
            anchor: string;
        }[];
        versions: {
            id: string;
            label: string;
            publishedAt: string;
            isConsolidated: boolean;
            diffSummary: string;
        }[];
        content: {
            heading: string;
            anchor: string;
            text: string;
        }[];
    }[];
}>;
export type CitationsBrowserData = z.infer<typeof CitationsBrowserDataSchema>;
export declare const MatterRiskLevelSchema: z.ZodEnum<["low", "medium", "high"]>;
export type MatterRiskLevel = z.infer<typeof MatterRiskLevelSchema>;
export declare const MatterTimelineEventSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    occurredAt: z.ZodString;
    actor: z.ZodString;
    summary: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    summary: string;
    label: string;
    occurredAt: string;
    actor: string;
}, {
    id: string;
    summary: string;
    label: string;
    occurredAt: string;
    actor: string;
}>;
export type MatterTimelineEvent = z.infer<typeof MatterTimelineEventSchema>;
export declare const MatterDeadlineEntrySchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    dueAt: z.ZodString;
    status: z.ZodEnum<["upcoming", "urgent", "passed"]>;
    jurisdiction: z.ZodString;
    note: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "upcoming" | "urgent" | "passed";
    jurisdiction: string;
    note: string;
    id: string;
    label: string;
    dueAt: string;
}, {
    status: "upcoming" | "urgent" | "passed";
    jurisdiction: string;
    note: string;
    id: string;
    label: string;
    dueAt: string;
}>;
export type MatterDeadlineEntry = z.infer<typeof MatterDeadlineEntrySchema>;
export declare const MatterDocumentNodeSchema: z.ZodType<{
    id: string;
    title: string;
    kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
    citeCheck: 'clean' | 'issues' | 'pending';
    updatedAt: string;
    author: string;
    children?: any;
}>;
export type MatterDocumentNode = z.infer<typeof MatterDocumentNodeSchema>;
export declare const MatterSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    client: z.ZodString;
    opposing: z.ZodString;
    governingLaw: z.ZodString;
    riskLevel: z.ZodEnum<["low", "medium", "high"]>;
    stage: z.ZodString;
    nextHearing: z.ZodString;
    principalIssue: z.ZodString;
    documents: z.ZodArray<z.ZodType<{
        id: string;
        title: string;
        kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
        citeCheck: "clean" | "issues" | "pending";
        updatedAt: string;
        author: string;
        children?: any;
    }, z.ZodTypeDef, {
        id: string;
        title: string;
        kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
        citeCheck: "clean" | "issues" | "pending";
        updatedAt: string;
        author: string;
        children?: any;
    }>, "many">;
    deadlines: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        dueAt: z.ZodString;
        status: z.ZodEnum<["upcoming", "urgent", "passed"]>;
        jurisdiction: z.ZodString;
        note: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }, {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }>, "many">;
    timeline: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        occurredAt: z.ZodString;
        actor: z.ZodString;
        summary: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        summary: string;
        label: string;
        occurredAt: string;
        actor: string;
    }, {
        id: string;
        summary: string;
        label: string;
        occurredAt: string;
        actor: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    riskLevel: "low" | "medium" | "high";
    id: string;
    name: string;
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    documents: {
        id: string;
        title: string;
        kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
        citeCheck: "clean" | "issues" | "pending";
        updatedAt: string;
        author: string;
        children?: any;
    }[];
    deadlines: {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }[];
    timeline: {
        id: string;
        summary: string;
        label: string;
        occurredAt: string;
        actor: string;
    }[];
}, {
    riskLevel: "low" | "medium" | "high";
    id: string;
    name: string;
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    documents: {
        id: string;
        title: string;
        kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
        citeCheck: "clean" | "issues" | "pending";
        updatedAt: string;
        author: string;
        children?: any;
    }[];
    deadlines: {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }[];
    timeline: {
        id: string;
        summary: string;
        label: string;
        occurredAt: string;
        actor: string;
    }[];
}>;
export type MatterSummary = z.infer<typeof MatterSummarySchema>;
export declare const MattersOverviewSchema: z.ZodObject<{
    matters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        client: z.ZodString;
        opposing: z.ZodString;
        governingLaw: z.ZodString;
        riskLevel: z.ZodEnum<["low", "medium", "high"]>;
        stage: z.ZodString;
        nextHearing: z.ZodString;
        principalIssue: z.ZodString;
        documents: z.ZodArray<z.ZodType<{
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }, z.ZodTypeDef, {
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }>, "many">;
        deadlines: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            dueAt: z.ZodString;
            status: z.ZodEnum<["upcoming", "urgent", "passed"]>;
            jurisdiction: z.ZodString;
            note: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }, {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }>, "many">;
        timeline: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            occurredAt: z.ZodString;
            actor: z.ZodString;
            summary: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }, {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }, {
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    matters: {
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }[];
}, {
    matters: {
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: "pleading" | "evidence" | "correspondence" | "analysis" | "order";
            citeCheck: "clean" | "issues" | "pending";
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            id: string;
            summary: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }[];
}>;
export type MattersOverview = z.infer<typeof MattersOverviewSchema>;
export declare const HitlRiskLevelSchema: z.ZodEnum<["low", "medium", "high"]>;
export type HitlRiskLevel = z.infer<typeof HitlRiskLevelSchema>;
export declare const HitlOutcomeSchema: z.ZodEnum<["approved", "changes_requested", "rejected"]>;
export type HitlOutcome = z.infer<typeof HitlOutcomeSchema>;
export declare const HitlEvidenceReferenceSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    uri: z.ZodString;
    type: z.ZodEnum<["statute", "case", "regulation", "doctrine"]>;
}, "strict", z.ZodTypeAny, {
    type: "statute" | "regulation" | "case" | "doctrine";
    id: string;
    label: string;
    uri: string;
}, {
    type: "statute" | "regulation" | "case" | "doctrine";
    id: string;
    label: string;
    uri: string;
}>;
export type HitlEvidenceReference = z.infer<typeof HitlEvidenceReferenceSchema>;
export declare const HitlIracBlockSchema: z.ZodObject<{
    issue: z.ZodString;
    rules: z.ZodArray<z.ZodString, "many">;
    application: z.ZodString;
    conclusion: z.ZodString;
}, "strict", z.ZodTypeAny, {
    issue: string;
    rules: string[];
    application: string;
    conclusion: string;
}, {
    issue: string;
    rules: string[];
    application: string;
    conclusion: string;
}>;
export type HitlIracBlock = z.infer<typeof HitlIracBlockSchema>;
export declare const HitlReviewItemSchema: z.ZodObject<{
    id: z.ZodString;
    submittedAt: z.ZodString;
    matter: z.ZodString;
    agent: z.ZodString;
    locale: z.ZodString;
    riskLevel: z.ZodEnum<["low", "medium", "high"]>;
    requiresTranslationCheck: z.ZodBoolean;
    litigationType: z.ZodEnum<["civil", "commercial", "labor", "administrative"]>;
    summary: z.ZodString;
    irac: z.ZodObject<{
        issue: z.ZodString;
        rules: z.ZodArray<z.ZodString, "many">;
        application: z.ZodString;
        conclusion: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        issue: string;
        rules: string[];
        application: string;
        conclusion: string;
    }, {
        issue: string;
        rules: string[];
        application: string;
        conclusion: string;
    }>;
    evidence: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        uri: z.ZodString;
        type: z.ZodEnum<["statute", "case", "regulation", "doctrine"]>;
    }, "strict", z.ZodTypeAny, {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }, {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }>, "many">;
    deltas: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    riskLevel: "low" | "medium" | "high";
    id: string;
    summary: string;
    evidence: {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }[];
    submittedAt: string;
    matter: string;
    agent: string;
    locale: string;
    requiresTranslationCheck: boolean;
    litigationType: "civil" | "commercial" | "labor" | "administrative";
    irac: {
        issue: string;
        rules: string[];
        application: string;
        conclusion: string;
    };
    deltas: string[];
}, {
    riskLevel: "low" | "medium" | "high";
    id: string;
    summary: string;
    evidence: {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }[];
    submittedAt: string;
    matter: string;
    agent: string;
    locale: string;
    requiresTranslationCheck: boolean;
    litigationType: "civil" | "commercial" | "labor" | "administrative";
    irac: {
        issue: string;
        rules: string[];
        application: string;
        conclusion: string;
    };
    deltas: string[];
}>;
export type HitlReviewItem = z.infer<typeof HitlReviewItemSchema>;
export declare const HitlQueueDataSchema: z.ZodObject<{
    queue: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        submittedAt: z.ZodString;
        matter: z.ZodString;
        agent: z.ZodString;
        locale: z.ZodString;
        riskLevel: z.ZodEnum<["low", "medium", "high"]>;
        requiresTranslationCheck: z.ZodBoolean;
        litigationType: z.ZodEnum<["civil", "commercial", "labor", "administrative"]>;
        summary: z.ZodString;
        irac: z.ZodObject<{
            issue: z.ZodString;
            rules: z.ZodArray<z.ZodString, "many">;
            application: z.ZodString;
            conclusion: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        }, {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        }>;
        evidence: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            uri: z.ZodString;
            type: z.ZodEnum<["statute", "case", "regulation", "doctrine"]>;
        }, "strict", z.ZodTypeAny, {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }, {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }>, "many">;
        deltas: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        riskLevel: "low" | "medium" | "high";
        id: string;
        summary: string;
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        submittedAt: string;
        matter: string;
        agent: string;
        locale: string;
        requiresTranslationCheck: boolean;
        litigationType: "civil" | "commercial" | "labor" | "administrative";
        irac: {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        };
        deltas: string[];
    }, {
        riskLevel: "low" | "medium" | "high";
        id: string;
        summary: string;
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        submittedAt: string;
        matter: string;
        agent: string;
        locale: string;
        requiresTranslationCheck: boolean;
        litigationType: "civil" | "commercial" | "labor" | "administrative";
        irac: {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        };
        deltas: string[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    queue: {
        riskLevel: "low" | "medium" | "high";
        id: string;
        summary: string;
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        submittedAt: string;
        matter: string;
        agent: string;
        locale: string;
        requiresTranslationCheck: boolean;
        litigationType: "civil" | "commercial" | "labor" | "administrative";
        irac: {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        };
        deltas: string[];
    }[];
}, {
    queue: {
        riskLevel: "low" | "medium" | "high";
        id: string;
        summary: string;
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        submittedAt: string;
        matter: string;
        agent: string;
        locale: string;
        requiresTranslationCheck: boolean;
        litigationType: "civil" | "commercial" | "labor" | "administrative";
        irac: {
            issue: string;
            rules: string[];
            application: string;
            conclusion: string;
        };
        deltas: string[];
    }[];
}>;
export type HitlQueueData = z.infer<typeof HitlQueueDataSchema>;
export declare const AllowlistSourceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    jurisdiction: z.ZodString;
    enabled: z.ZodBoolean;
    lastIndexed: z.ZodString;
    type: z.ZodEnum<["official", "secondary", "internal"]>;
}, "strict", z.ZodTypeAny, {
    type: "official" | "secondary" | "internal";
    jurisdiction: string;
    id: string;
    name: string;
    enabled: boolean;
    lastIndexed: string;
}, {
    type: "official" | "secondary" | "internal";
    jurisdiction: string;
    id: string;
    name: string;
    enabled: boolean;
    lastIndexed: string;
}>;
export type AllowlistSource = z.infer<typeof AllowlistSourceSchema>;
export declare const IntegrationStatusSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    provider: z.ZodString;
    status: z.ZodEnum<["connected", "error", "syncing", "disconnected"]>;
    lastSync: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "error" | "connected" | "syncing" | "disconnected";
    id: string;
    name: string;
    provider: string;
    message?: string | undefined;
    lastSync?: string | undefined;
}, {
    status: "error" | "connected" | "syncing" | "disconnected";
    id: string;
    name: string;
    provider: string;
    message?: string | undefined;
    lastSync?: string | undefined;
}>;
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
export declare const SnapshotEntrySchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    createdAt: z.ZodString;
    author: z.ZodString;
    sizeMb: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    label: string;
    author: string;
    sizeMb: number;
}, {
    id: string;
    createdAt: string;
    label: string;
    author: string;
    sizeMb: number;
}>;
export type SnapshotEntry = z.infer<typeof SnapshotEntrySchema>;
export declare const IngestionJobSchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    status: z.ZodEnum<["processing", "failed", "ready"]>;
    submittedAt: z.ZodString;
    jurisdiction: z.ZodString;
    progress: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "processing" | "ready";
    jurisdiction: string;
    id: string;
    submittedAt: string;
    filename: string;
    progress: number;
    note?: string | undefined;
}, {
    status: "failed" | "processing" | "ready";
    jurisdiction: string;
    id: string;
    submittedAt: string;
    filename: string;
    progress: number;
    note?: string | undefined;
}>;
export type IngestionJob = z.infer<typeof IngestionJobSchema>;
export declare const CorpusDashboardDataSchema: z.ZodObject<{
    allowlist: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        jurisdiction: z.ZodString;
        enabled: z.ZodBoolean;
        lastIndexed: z.ZodString;
        type: z.ZodEnum<["official", "secondary", "internal"]>;
    }, "strict", z.ZodTypeAny, {
        type: "official" | "secondary" | "internal";
        jurisdiction: string;
        id: string;
        name: string;
        enabled: boolean;
        lastIndexed: string;
    }, {
        type: "official" | "secondary" | "internal";
        jurisdiction: string;
        id: string;
        name: string;
        enabled: boolean;
        lastIndexed: string;
    }>, "many">;
    integrations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        status: z.ZodEnum<["connected", "error", "syncing", "disconnected"]>;
        lastSync: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "error" | "connected" | "syncing" | "disconnected";
        id: string;
        name: string;
        provider: string;
        message?: string | undefined;
        lastSync?: string | undefined;
    }, {
        status: "error" | "connected" | "syncing" | "disconnected";
        id: string;
        name: string;
        provider: string;
        message?: string | undefined;
        lastSync?: string | undefined;
    }>, "many">;
    snapshots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        createdAt: z.ZodString;
        author: z.ZodString;
        sizeMb: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        label: string;
        author: string;
        sizeMb: number;
    }, {
        id: string;
        createdAt: string;
        label: string;
        author: string;
        sizeMb: number;
    }>, "many">;
    ingestionJobs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        status: z.ZodEnum<["processing", "failed", "ready"]>;
        submittedAt: z.ZodString;
        jurisdiction: z.ZodString;
        progress: z.ZodNumber;
        note: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "failed" | "processing" | "ready";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }, {
        status: "failed" | "processing" | "ready";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    allowlist: {
        type: "official" | "secondary" | "internal";
        jurisdiction: string;
        id: string;
        name: string;
        enabled: boolean;
        lastIndexed: string;
    }[];
    integrations: {
        status: "error" | "connected" | "syncing" | "disconnected";
        id: string;
        name: string;
        provider: string;
        message?: string | undefined;
        lastSync?: string | undefined;
    }[];
    snapshots: {
        id: string;
        createdAt: string;
        label: string;
        author: string;
        sizeMb: number;
    }[];
    ingestionJobs: {
        status: "failed" | "processing" | "ready";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }[];
}, {
    allowlist: {
        type: "official" | "secondary" | "internal";
        jurisdiction: string;
        id: string;
        name: string;
        enabled: boolean;
        lastIndexed: string;
    }[];
    integrations: {
        status: "error" | "connected" | "syncing" | "disconnected";
        id: string;
        name: string;
        provider: string;
        message?: string | undefined;
        lastSync?: string | undefined;
    }[];
    snapshots: {
        id: string;
        createdAt: string;
        label: string;
        author: string;
        sizeMb: number;
    }[];
    ingestionJobs: {
        status: "failed" | "processing" | "ready";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }[];
}>;
export type CorpusDashboardData = z.infer<typeof CorpusDashboardDataSchema>;
export declare const PolicyConfigurationSchema: z.ZodObject<{
    statute_first: z.ZodBoolean;
    ohada_preemption_priority: z.ZodBoolean;
    binding_language_guardrail: z.ZodBoolean;
    sensitive_topic_hitl: z.ZodBoolean;
    confidential_mode: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    statute_first: boolean;
    ohada_preemption_priority: boolean;
    binding_language_guardrail: boolean;
    sensitive_topic_hitl: boolean;
    confidential_mode: boolean;
}, {
    statute_first: boolean;
    ohada_preemption_priority: boolean;
    binding_language_guardrail: boolean;
    sensitive_topic_hitl: boolean;
    confidential_mode: boolean;
}>;
export type PolicyConfiguration = z.infer<typeof PolicyConfigurationSchema>;
export declare const UploadResponseSchema: z.ZodObject<{
    uploadId: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "indexed"]>;
    receivedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "queued" | "processing" | "indexed";
    uploadId: string;
    receivedAt: string;
}, {
    status: "queued" | "processing" | "indexed";
    uploadId: string;
    receivedAt: string;
}>;
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
export declare const VoiceToolIntentStatusSchema: z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>;
export type VoiceToolIntentStatus = z.infer<typeof VoiceToolIntentStatusSchema>;
export declare const VoiceToolIntentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    tool: z.ZodString;
    status: z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>;
    detail: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "completed" | "running" | "requires_hitl" | "scheduled";
    id: string;
    name: string;
    detail: string;
    tool: string;
}, {
    status: "completed" | "running" | "requires_hitl" | "scheduled";
    id: string;
    name: string;
    detail: string;
    tool: string;
}>;
export type VoiceToolIntent = z.infer<typeof VoiceToolIntentSchema>;
export declare const VoiceCitationSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    href: z.ZodString;
    snippet: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    label: string;
    href: string;
    snippet: string;
}, {
    id: string;
    label: string;
    href: string;
    snippet: string;
}>;
export type VoiceCitation = z.infer<typeof VoiceCitationSchema>;
export declare const VoiceSessionSummarySchema: z.ZodObject<{
    id: z.ZodString;
    startedAt: z.ZodString;
    durationMs: z.ZodNumber;
    transcript: z.ZodString;
    summary: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        href: z.ZodString;
        snippet: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }, {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }>, "many">;
    intents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        tool: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        tool: string;
    }, {
        id: string;
        name: string;
        tool: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    id: string;
    startedAt: string;
    summary: string;
    durationMs: number;
    transcript: string;
    intents: {
        id: string;
        name: string;
        tool: string;
    }[];
}, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    id: string;
    startedAt: string;
    summary: string;
    durationMs: number;
    transcript: string;
    intents: {
        id: string;
        name: string;
        tool: string;
    }[];
}>;
export type VoiceSessionSummary = z.infer<typeof VoiceSessionSummarySchema>;
export declare const VoiceConsoleContextSchema: z.ZodObject<{
    suggestions: z.ZodArray<z.ZodString, "many">;
    quickIntents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        tool: z.ZodString;
        status: z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>;
        detail: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }, {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }>, "many">;
    recentSessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        startedAt: z.ZodString;
        durationMs: z.ZodNumber;
        transcript: z.ZodString;
        summary: z.ZodString;
        citations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            href: z.ZodString;
            snippet: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }, {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }>, "many">;
        intents: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            tool: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            tool: string;
        }, {
            id: string;
            name: string;
            tool: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        id: string;
        startedAt: string;
        summary: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
        }[];
    }, {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        id: string;
        startedAt: string;
        summary: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
        }[];
    }>, "many">;
    guardrails: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    guardrails: string[];
    suggestions: string[];
    quickIntents: {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }[];
    recentSessions: {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        id: string;
        startedAt: string;
        summary: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
        }[];
    }[];
}, {
    guardrails: string[];
    suggestions: string[];
    quickIntents: {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }[];
    recentSessions: {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        id: string;
        startedAt: string;
        summary: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
        }[];
    }[];
}>;
export type VoiceConsoleContext = z.infer<typeof VoiceConsoleContextSchema>;
export declare const VoiceRunRequestSchema: z.ZodObject<{
    agent_id: z.ZodString;
    locale: z.ZodString;
    transcript: z.ZodString;
    intents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    citations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    citations: string[];
    agent_id: string;
    locale: string;
    transcript: string;
    intents: string[];
}, {
    agent_id: string;
    locale: string;
    transcript: string;
    citations?: string[] | undefined;
    intents?: string[] | undefined;
}>;
export type VoiceRunRequest = z.infer<typeof VoiceRunRequestSchema>;
export declare const VoiceRunResponseSchema: z.ZodObject<{
    id: z.ZodString;
    summary: z.ZodString;
    followUps: z.ZodArray<z.ZodString, "many">;
    citations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        href: z.ZodString;
        snippet: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }, {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }>, "many">;
    intents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        tool: z.ZodString;
        status: z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>;
        detail: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }, {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }>, "many">;
    readback: z.ZodArray<z.ZodString, "many">;
    riskLevel: z.ZodDefault<z.ZodEnum<["LOW", "MED", "HIGH"]>>;
    clarifications: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    riskLevel: "LOW" | "HIGH" | "MED";
    followUps: string[];
    id: string;
    summary: string;
    intents: {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }[];
    readback: string[];
    clarifications: string[];
}, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    followUps: string[];
    id: string;
    summary: string;
    intents: {
        status: "completed" | "running" | "requires_hitl" | "scheduled";
        id: string;
        name: string;
        detail: string;
        tool: string;
    }[];
    readback: string[];
    riskLevel?: "LOW" | "HIGH" | "MED" | undefined;
    clarifications?: string[] | undefined;
}>;
export type VoiceRunResponse = z.infer<typeof VoiceRunResponseSchema>;
//# sourceMappingURL=pwa.d.ts.map