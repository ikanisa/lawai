export interface JurisdictionMetadata {
    id: string;
    displayCode: string;
    labelFr: string;
    labelEn: string;
    eu?: boolean;
    ohada?: boolean;
    maghreb?: boolean;
    bilingual?: boolean;
    triLingual?: boolean;
    notes?: Array<'maghreb' | 'bilingual' | 'swiss' | 'residency'>;
}
export declare const SUPPORTED_JURISDICTIONS: JurisdictionMetadata[];
export declare const MAGHREB_JURISDICTIONS: string[];
//# sourceMappingURL=jurisdictions.d.ts.map