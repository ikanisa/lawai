import { type ResearchDeskContext, type ResearchPlan, type ResearchCitation, type ResearchStreamEvent, type WebSearchMode } from '@avocat-ai/shared';
export declare const researchDeskContext: ResearchDeskContext;
export declare function createResearchStream(input: string, toolsEnabled: readonly string[], webSearchMode?: WebSearchMode): ResearchStreamEvent[];
export declare function cloneResearchContext(): ResearchDeskContext;
export declare function getResearchPlan(): ResearchPlan;
export declare function getResearchCitations(): ResearchCitation[];
export declare function getResearchFilters(): any;
//# sourceMappingURL=data.d.ts.map