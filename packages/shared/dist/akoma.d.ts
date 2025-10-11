export type AkomaArticle = {
    marker: string;
    heading: string;
    excerpt: string;
    paragraphs: string[];
    section?: string | null;
};
export type AkomaSection = {
    heading: string;
    articles: AkomaArticle[];
};
export type AkomaBody = {
    sections: AkomaSection[];
    articles: AkomaArticle[];
};
export declare function extractPlainTextFromBuffer(payload: Uint8Array, mimeType: string): string;
export declare function buildAkomaBodyFromText(text: string): AkomaBody | null;
export type CaseTreatmentHint = {
    reference: string;
    sentence: string;
    treatment: 'followed' | 'applied' | 'distinguished' | 'overruled' | 'criticized' | 'questioned';
    weight: number;
    ecli?: string;
};
export declare function extractCaseTreatmentHints(text: string): CaseTreatmentHint[];
//# sourceMappingURL=akoma.d.ts.map