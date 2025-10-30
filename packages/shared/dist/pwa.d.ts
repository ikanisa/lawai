import { z } from 'zod';
export declare const AgentRunStatusSchema: z.ZodEnum<["queued", "running", "succeeded", "failed", "requires_hitl"]>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export declare const WebSearchModeSchema: z.ZodEnum<["disabled", "allowlist", "broad"]>;
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
    userLocation: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "queued" | "failed" | "running" | "succeeded" | "requires_hitl";
    jurisdiction: string | null;
    id: string;
    agentId: string;
    threadId: string;
    createdAt: string;
    updatedAt: string;
    input: string;
    policyFlags: string[];
    userLocation: string | null;
}, {
    status: "queued" | "failed" | "running" | "succeeded" | "requires_hitl";
    id: string;
    agentId: string;
    threadId: string;
    createdAt: string;
    updatedAt: string;
    input: string;
    jurisdiction?: string | null | undefined;
    policyFlags?: string[] | undefined;
    userLocation?: string | null | undefined;
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
    status: "error" | "running" | "success";
    detail: string;
    id: string;
    name: string;
    startedAt: string;
    planStepId?: string | null | undefined;
    completedAt?: string | null | undefined;
}, {
    status: "error" | "running" | "success";
    detail: string;
    id: string;
    name: string;
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
    user_location: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    input: string;
    agent_id: string;
    tools_enabled: string[];
    policy_flags: string[];
    jurisdiction?: string | null | undefined;
    user_location?: string | undefined;
}, {
    input: string;
    agent_id: string;
    jurisdiction?: string | null | undefined;
    tools_enabled?: string[] | undefined;
    policy_flags?: string[] | undefined;
    user_location?: string | undefined;
}>;
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;
export declare const AgentStreamRequestSchema: z.ZodObject<{
    input: z.ZodString;
    agent_id: z.ZodString;
    run_id: z.ZodString;
    thread_id: z.ZodString;
    tools_enabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    user_location: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    input: string;
    agent_id: string;
    tools_enabled: string[];
    run_id: string;
    thread_id: string;
    user_location?: string | undefined;
}, {
    input: string;
    agent_id: string;
    run_id: string;
    thread_id: string;
    tools_enabled?: string[] | undefined;
    user_location?: string | undefined;
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
    status: "done" | "active" | "pending";
    title: string;
    summary: string;
    id: string;
    tool: string;
}, {
    status: "done" | "active" | "pending";
    title: string;
    summary: string;
    id: string;
    tool: string;
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
        status: "done" | "active" | "pending";
        title: string;
        summary: string;
        id: string;
        tool: string;
    }, {
        status: "done" | "active" | "pending";
        title: string;
        summary: string;
        id: string;
        tool: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    jurisdiction: string;
    title: string;
    id: string;
    riskLevel: "LOW" | "HIGH" | "MED";
    riskSummary: string;
    steps: {
        status: "done" | "active" | "pending";
        title: string;
        summary: string;
        id: string;
        tool: string;
    }[];
    riskSummary: string;
}, {
    jurisdiction: string;
    title: string;
    id: string;
    riskLevel: "LOW" | "HIGH" | "MED";
    riskSummary: string;
    steps: {
        status: "done" | "active" | "pending";
        title: string;
        summary: string;
        id: string;
        tool: string;
    }[];
    riskSummary: string;
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
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }, {
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        jurisdiction: string;
        title: string;
        id: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        riskSummary: string;
        steps: {
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }[];
        riskSummary: string;
    }, {
        jurisdiction: string;
        title: string;
        id: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        riskSummary: string;
        steps: {
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }[];
        riskSummary: string;
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
        id: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        riskSummary: string;
        steps: {
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }[];
        riskSummary: string;
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
        id: string;
        riskLevel: "LOW" | "HIGH" | "MED";
        riskSummary: string;
        steps: {
            status: "done" | "active" | "pending";
            title: string;
            summary: string;
            id: string;
            tool: string;
        }[];
        riskSummary: string;
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
        status: "error" | "running" | "success";
        detail: string;
        id: string;
        name: string;
        planStepId?: string | null | undefined;
    }, {
        status: "error" | "running" | "success";
        detail: string;
        id: string;
        name: string;
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
        status: "error" | "running" | "success";
        detail: string;
        id: string;
        name: string;
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
        status: "error" | "running" | "success";
        detail: string;
        id: string;
        name: string;
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
        text: string;
        anchor: string;
    }, {
        heading: string;
        text: string;
        anchor: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "statute" | "regulation" | "case" | "doctrine";
    jurisdiction: string;
    title: string;
    id: string;
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
    metadata: Record<string, string>;
    content: {
        heading: string;
        text: string;
        anchor: string;
    }[];
}, {
    type: "statute" | "regulation" | "case" | "doctrine";
    jurisdiction: string;
    title: string;
    id: string;
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
    metadata: Record<string, string>;
    content: {
        heading: string;
        text: string;
        anchor: string;
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
            text: string;
            anchor: string;
        }, {
            heading: string;
            text: string;
            anchor: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
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
            text: string;
            anchor: string;
        }, {
            heading: string;
            text: string;
            anchor: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }, {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    results: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }[];
    ohadaFeatured: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }[];
}, {
    results: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
        }[];
    }[];
    ohadaFeatured: {
        type: "statute" | "regulation" | "case" | "doctrine";
        jurisdiction: string;
        title: string;
        id: string;
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
        metadata: Record<string, string>;
        content: {
            heading: string;
            text: string;
            anchor: string;
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
    summary: string;
    id: string;
    label: string;
    occurredAt: string;
    actor: string;
}, {
    summary: string;
    id: string;
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
        kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
        citeCheck: 'clean' | 'issues' | 'pending';
        updatedAt: string;
        author: string;
        children?: any;
    }, z.ZodTypeDef, {
        id: string;
        title: string;
        kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
        citeCheck: 'clean' | 'issues' | 'pending';
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
        summary: string;
        id: string;
        label: string;
        occurredAt: string;
        actor: string;
    }, {
        summary: string;
        id: string;
        label: string;
        occurredAt: string;
        actor: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    riskLevel: "low" | "medium" | "high";
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    documents: {
        id: string;
        title: string;
        kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
        citeCheck: 'clean' | 'issues' | 'pending';
        updatedAt: string;
        author: string;
        children?: any;
    }[];
    riskLevel: "low" | "medium" | "high";
    id: string;
    name: string;
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    deadlines: {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }[];
    timeline: {
        summary: string;
        id: string;
        label: string;
        occurredAt: string;
        actor: string;
    }[];
}, {
    id: string;
    name: string;
    riskLevel: "low" | "medium" | "high";
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    documents: {
        id: string;
        title: string;
        kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
        citeCheck: 'clean' | 'issues' | 'pending';
        updatedAt: string;
        author: string;
        children?: any;
    }[];
    riskLevel: "low" | "medium" | "high";
    id: string;
    name: string;
    client: string;
    opposing: string;
    governingLaw: string;
    stage: string;
    nextHearing: string;
    principalIssue: string;
    deadlines: {
        status: "upcoming" | "urgent" | "passed";
        jurisdiction: string;
        note: string;
        id: string;
        label: string;
        dueAt: string;
    }[];
    timeline: {
        summary: string;
        id: string;
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
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
            updatedAt: string;
            author: string;
            children?: any;
        }, z.ZodTypeDef, {
            id: string;
            title: string;
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
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
            summary: string;
            id: string;
            label: string;
            occurredAt: string;
            actor: string;
        }, {
            summary: string;
            id: string;
            label: string;
            occurredAt: string;
            actor: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        id: string;
        name: string;
        riskLevel: "low" | "medium" | "high";
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            summary: string;
            id: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }, {
        id: string;
        name: string;
        riskLevel: "low" | "medium" | "high";
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            summary: string;
            id: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    matters: {
        id: string;
        name: string;
        riskLevel: "low" | "medium" | "high";
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            summary: string;
            id: string;
            label: string;
            occurredAt: string;
            actor: string;
        }[];
    }[];
}, {
    matters: {
        id: string;
        name: string;
        riskLevel: "low" | "medium" | "high";
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        documents: {
            id: string;
            title: string;
            kind: 'pleading' | 'evidence' | 'correspondence' | 'analysis' | 'order';
            citeCheck: 'clean' | 'issues' | 'pending';
            updatedAt: string;
            author: string;
            children?: any;
        }[];
        riskLevel: "low" | "medium" | "high";
        id: string;
        name: string;
        client: string;
        opposing: string;
        governingLaw: string;
        stage: string;
        nextHearing: string;
        principalIssue: string;
        deadlines: {
            status: "upcoming" | "urgent" | "passed";
            jurisdiction: string;
            note: string;
            id: string;
            label: string;
            dueAt: string;
        }[];
        timeline: {
            summary: string;
            id: string;
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
    id: string;
    summary: string;
    riskLevel: "low" | "medium" | "high";
    evidence: {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }[];
    summary: string;
    riskLevel: "low" | "medium" | "high";
    id: string;
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
    id: string;
    summary: string;
    riskLevel: "low" | "medium" | "high";
    evidence: {
        type: "statute" | "regulation" | "case" | "doctrine";
        id: string;
        label: string;
        uri: string;
    }[];
    summary: string;
    riskLevel: "low" | "medium" | "high";
    id: string;
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
        id: string;
        summary: string;
        riskLevel: "low" | "medium" | "high";
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        summary: string;
        riskLevel: "low" | "medium" | "high";
        id: string;
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
        id: string;
        summary: string;
        riskLevel: "low" | "medium" | "high";
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        summary: string;
        riskLevel: "low" | "medium" | "high";
        id: string;
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
        id: string;
        summary: string;
        riskLevel: "low" | "medium" | "high";
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        summary: string;
        riskLevel: "low" | "medium" | "high";
        id: string;
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
        id: string;
        summary: string;
        riskLevel: "low" | "medium" | "high";
        evidence: {
            type: "statute" | "regulation" | "case" | "doctrine";
            id: string;
            label: string;
            uri: string;
        }[];
        summary: string;
        riskLevel: "low" | "medium" | "high";
        id: string;
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
    status: "syncing" | "error" | "connected" | "disconnected";
    id: string;
    name: string;
    provider: string;
    message?: string | undefined;
    lastSync?: string | undefined;
}, {
    status: "syncing" | "error" | "connected" | "disconnected";
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
export declare const UploadDocumentEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodString;
    residencyZone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["queued", "processing", "indexed", "quarantined", "failed"]>>;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    name: string;
    status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
    residencyZone?: string | null | undefined;
}, {
    id: string;
    createdAt: string;
    name: string;
    status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
    residencyZone?: string | null | undefined;
}>;
export type UploadDocumentEntry = z.infer<typeof UploadDocumentEntrySchema>;
export declare const IngestionJobSchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    status: z.ZodEnum<["processing", "failed", "ready"]>;
    submittedAt: z.ZodString;
    jurisdiction: z.ZodString;
    progress: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "ready" | "processing";
    jurisdiction: string;
    id: string;
    submittedAt: string;
    filename: string;
    progress: number;
    note?: string | undefined;
}, {
    status: "failed" | "ready" | "processing";
    jurisdiction: string;
    id: string;
    submittedAt: string;
    filename: string;
    progress: number;
    note?: string | undefined;
}>;
export type IngestionJob = z.infer<typeof IngestionJobSchema>;
export declare const ResidencySummarySchema: z.ZodObject<{
    activeZone: z.ZodNullable<z.ZodString>;
    allowedZones: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    activeZone: string | null;
    allowedZones: string[] | null;
}, {
    activeZone: string | null;
    allowedZones: string[] | null;
}>;
export type ResidencySummary = z.infer<typeof ResidencySummarySchema>;
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
        status: "syncing" | "error" | "connected" | "disconnected";
        id: string;
        name: string;
        provider: string;
        message?: string | undefined;
        lastSync?: string | undefined;
    }, {
        status: "syncing" | "error" | "connected" | "disconnected";
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
        status: "failed" | "ready" | "processing";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }, {
        status: "failed" | "ready" | "processing";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }>, "many">;
    uploads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodString;
        residencyZone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodEnum<["queued", "processing", "indexed", "quarantined", "failed"]>>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        name: string;
        status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
        residencyZone?: string | null | undefined;
    }, {
        id: string;
        createdAt: string;
        name: string;
        status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
        residencyZone?: string | null | undefined;
    }>, "many">;
    residency: z.ZodOptional<z.ZodObject<{
        activeZone: z.ZodNullable<z.ZodString>;
        allowedZones: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        activeZone: string | null;
        allowedZones: string[] | null;
    }, {
        activeZone: string | null;
        allowedZones: string[] | null;
    }>>;
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
        status: "syncing" | "error" | "connected" | "disconnected";
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
        status: "failed" | "ready" | "processing";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }[];
    uploads: {
        id: string;
        createdAt: string;
        name: string;
        status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
        residencyZone?: string | null | undefined;
    }[];
    residency?: {
        activeZone: string | null;
        allowedZones: string[] | null;
    } | undefined;
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
        status: "syncing" | "error" | "connected" | "disconnected";
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
        status: "failed" | "ready" | "processing";
        jurisdiction: string;
        id: string;
        submittedAt: string;
        filename: string;
        progress: number;
        note?: string | undefined;
    }[];
    uploads: {
        id: string;
        createdAt: string;
        name: string;
        status?: "queued" | "failed" | "processing" | "indexed" | "quarantined" | undefined;
        residencyZone?: string | null | undefined;
    }[];
    residency?: {
        activeZone: string | null;
        allowedZones: string[] | null;
    } | undefined;
}>;
export type CorpusDashboardData = z.infer<typeof CorpusDashboardDataSchema>;
export declare const PolicyConfigurationSchema: z.ZodObject<{
    statute_first: z.ZodBoolean;
    ohada_preemption_priority: z.ZodBoolean;
    binding_language_guardrail: z.ZodBoolean;
    sensitive_topic_hitl: z.ZodBoolean;
    confidential_mode: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    confidential_mode: boolean;
    sensitive_topic_hitl: boolean;
    statute_first: boolean;
    ohada_preemption_priority: boolean;
    binding_language_guardrail: boolean;
}, {
    confidential_mode: boolean;
    sensitive_topic_hitl: boolean;
    statute_first: boolean;
    ohada_preemption_priority: boolean;
    binding_language_guardrail: boolean;
}>;
export type PolicyConfiguration = z.infer<typeof PolicyConfigurationSchema>;
export declare const UploadContractSchema: z.ZodObject<{
    bucket: z.ZodString;
    path: z.ZodString;
    url: z.ZodString;
    token: z.ZodString;
    expiresAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    path: string;
    url: string;
    token: string;
    bucket: string;
    expiresAt: string;
}, {
    path: string;
    url: string;
    token: string;
    bucket: string;
    expiresAt: string;
}>;
export type UploadContract = z.infer<typeof UploadContractSchema>;
export declare const UploadResponseSchema: z.ZodObject<{
    uploadId: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "indexed"]>;
    receivedAt: z.ZodString;
    upload: z.ZodObject<{
        bucket: z.ZodString;
        path: z.ZodString;
        url: z.ZodString;
        token: z.ZodString;
        expiresAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        path: string;
        url: string;
        token: string;
        bucket: string;
        expiresAt: string;
    }, {
        path: string;
        url: string;
        token: string;
        bucket: string;
        expiresAt: string;
    }>;
    quarantine: z.ZodOptional<z.ZodObject<{
        reason: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["pending", "resolved"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "resolved";
        reason: string;
    }, {
        reason: string;
        status?: "pending" | "resolved" | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    status: "queued" | "processing" | "indexed";
    uploadId: string;
    receivedAt: string;
    upload: {
        path: string;
        url: string;
        token: string;
        bucket: string;
        expiresAt: string;
    };
    quarantine?: {
        status: "pending" | "resolved";
        reason: string;
    } | undefined;
}, {
    status: "queued" | "processing" | "indexed";
    uploadId: string;
    receivedAt: string;
    upload: {
        path: string;
        url: string;
        token: string;
        bucket: string;
        expiresAt: string;
    };
    quarantine?: {
        reason: string;
        status?: "pending" | "resolved" | undefined;
    } | undefined;
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
    status: "running" | "requires_hitl" | "scheduled" | "completed";
    id: string;
    name: string;
    tool: string;
}, {
    status: "running" | "requires_hitl" | "scheduled" | "completed";
    id: string;
    name: string;
    tool: string;
}>;
export type VoiceToolIntent = z.infer<typeof VoiceToolIntentSchema>;
export declare const VoiceSessionIntentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    tool: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>>;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    tool: string;
    status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
}, {
    id: string;
    name: string;
    tool: string;
    status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
}>;
export type VoiceSessionIntent = z.infer<typeof VoiceSessionIntentSchema>;
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
        status: z.ZodOptional<z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        name: string;
        tool: string;
        status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
    }, {
        id: string;
        name: string;
        tool: string;
        status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    summary: string;
    id: string;
    startedAt: string;
    durationMs: number;
    transcript: string;
    intents: {
        id: string;
        name: string;
        tool: string;
        status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
    }[];
}, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    summary: string;
    id: string;
    startedAt: string;
    durationMs: number;
    transcript: string;
    intents: {
        id: string;
        name: string;
        tool: string;
        status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
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
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }, {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
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
            status: z.ZodOptional<z.ZodEnum<["scheduled", "running", "completed", "requires_hitl"]>>;
        }, "strict", z.ZodTypeAny, {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }, {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        summary: string;
        id: string;
        startedAt: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }[];
    }, {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        summary: string;
        id: string;
        startedAt: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }[];
    }>, "many">;
    guardrails: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    suggestions: string[];
    quickIntents: {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }[];
    recentSessions: {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        summary: string;
        id: string;
        startedAt: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }[];
    }[];
    guardrails: string[];
}, {
    suggestions: string[];
    quickIntents: {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }[];
    recentSessions: {
        citations: {
            id: string;
            label: string;
            href: string;
            snippet: string;
        }[];
        summary: string;
        id: string;
        startedAt: string;
        durationMs: number;
        transcript: string;
        intents: {
            id: string;
            name: string;
            tool: string;
            status?: "running" | "requires_hitl" | "scheduled" | "completed" | undefined;
        }[];
    }[];
    guardrails: string[];
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
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }, {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
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
    id: string;
    summary: string;
    riskLevel: "LOW" | "HIGH" | "MED";
    intents: {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }[];
    followUps: string[];
    readback: string[];
    clarifications: string[];
}, {
    citations: {
        id: string;
        label: string;
        href: string;
        snippet: string;
    }[];
    id: string;
    intents: {
        status: "running" | "requires_hitl" | "scheduled" | "completed";
        id: string;
        name: string;
        tool: string;
    }[];
    followUps: string[];
    readback: string[];
    riskLevel?: "LOW" | "HIGH" | "MED" | undefined;
    clarifications?: string[] | undefined;
}>;
export type VoiceRunResponse = z.infer<typeof VoiceRunResponseSchema>;
//# sourceMappingURL=pwa.d.ts.map