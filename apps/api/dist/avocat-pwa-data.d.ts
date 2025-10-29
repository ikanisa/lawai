import type { AllowlistSource, CitationDocument, CitationsBrowserData, CorpusDashboardData, HitlQueueData, MattersOverview, PolicyConfiguration, ResearchDeskContext, VoiceConsoleContext, VoiceRunResponse } from '@avocat-ai/shared';
export declare const researchDeskContext: ResearchDeskContext;
export declare const researchAnswerChunks: string[];
export declare const webSearchModes: readonly ["allowlist", "broad"];
export type WebSearchMode = (typeof webSearchModes)[number];
export declare const defaultWebSearchMode: WebSearchMode;
export declare const researchToolSummaries: {
    readonly lookupCodeArticle: {
        readonly start: "Analyse de l'article L110-1 et identification des obligations principales.";
        readonly success: "Article L110-1 enrichi avec les obligations essentielles et alignements OHADA.";
    };
    readonly web_search: {
        readonly allowlist: {
            readonly start: "Recherche des arrêts CCJA récents sur les clauses limitatives de responsabilité.";
            readonly success: "Décision CCJA 132/2022 identifiée et ajoutée aux citations.";
        };
        readonly broad: {
            readonly start: "Exploration élargie des bulletins OHADA et sources publiques spécialisées.";
            readonly success: "Sources élargies validées et intégrées au dossier de preuve.";
        };
    };
    readonly limitationCheck: {
        readonly start: "Calcul du délai de prescription applicable au contrat de services.";
        readonly success: "Prescription confirmée à deux ans, alerte sur interruption possible.";
    };
};
export declare const citationsData: CitationsBrowserData;
export declare const mattersData: MattersOverview;
export declare const hitlQueueData: HitlQueueData;
export declare const corpusDashboardData: CorpusDashboardData;
export declare const policyConfiguration: PolicyConfiguration;
export declare const voiceConsoleContext: VoiceConsoleContext;
export declare function buildVoiceRunResponse(transcript: string): VoiceRunResponse;
export declare const uploadAllowlist: AllowlistSource[];
export declare const ohadaHighlights: CitationDocument[];
//# sourceMappingURL=avocat-pwa-data.d.ts.map