type SignInput = {
    orgId: string;
    userId: string;
    contentSha256: string;
    filename?: string | null;
};
export type C2PASignature = {
    keyId: string;
    signedAt: string;
    algorithm: string;
    signature: string;
    statementId: string;
    manifest: {
        '@context': string;
        version: string;
        claim_generator: string;
        statement_id: string;
        signed_at: string;
        assertions: Array<{
            label: string;
            digest: {
                algorithm: string;
                value: string;
            };
            filename?: string | null;
        }>;
        subject?: {
            org: string;
            user: string;
        };
    };
};
export declare function signC2PA({ orgId, userId, contentSha256, filename }: SignInput): C2PASignature;
export {};
//# sourceMappingURL=c2pa.d.ts.map