export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';
export interface WebVitalRecord {
    id: string;
    name: string;
    value: number;
    delta: number;
    label: string;
    rating: WebVitalRating;
    page: string;
    locale: string | null;
    navigationType: string | null;
    userAgent: string | null;
    orgId: string;
    userId: string;
    createdAt: string;
}
export declare function recordWebVital(input: Omit<WebVitalRecord, 'createdAt'> & {
    createdAt?: string;
}): WebVitalRecord;
export declare function listWebVitals(orgId: string, limit?: number): WebVitalRecord[];
export declare function __resetWebVitalsForTests(): void;
//# sourceMappingURL=metrics.d.ts.map