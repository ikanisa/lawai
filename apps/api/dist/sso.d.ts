type Provider = 'saml' | 'oidc';
export interface SsoConnectionInput {
    id?: string;
    provider: Provider;
    label?: string;
    metadata?: Record<string, unknown>;
    acsUrl?: string;
    entityId?: string;
    clientId?: string;
    clientSecret?: string;
    defaultRole?: string;
    groupMappings?: Record<string, string>;
}
export interface ScimTokenRecord {
    id: string;
    name: string;
    createdAt: string;
    createdBy?: string | null;
    expiresAt?: string | null;
    lastUsedAt?: string | null;
}
export declare function hashToken(token: string): string;
export declare function listSsoConnections(orgId: string): Promise<any>;
export declare function upsertSsoConnection(orgId: string, actorId: string, input: SsoConnectionInput): Promise<{
    id: string;
    orgId: string;
    provider: Provider;
    label: string | null;
    metadata: Record<string, unknown>;
    acsUrl: string | null;
    entityId: string | null;
    clientId: string | null;
    defaultRole: string;
    groupMappings: Record<string, string>;
    createdAt: string;
    updatedAt: string;
} | null>;
export declare function deleteSsoConnection(orgId: string, actorId: string, id: string): Promise<void>;
export declare function listScimTokens(orgId: string): Promise<ScimTokenRecord[]>;
export declare function createScimToken(orgId: string, actorId: string, name: string, expiresAt?: string | null): Promise<{
    id: string;
    token: string;
    expiresAt: string | null | undefined;
}>;
export declare function deleteScimToken(orgId: string, actorId: string, id: string): Promise<void>;
export interface IpAllowlistInput {
    id?: string;
    cidr: string;
    description?: string | null;
}
export declare function listIpAllowlist(orgId: string): Promise<any>;
export declare function upsertIpAllowlist(orgId: string, actorId: string, input: IpAllowlistInput): Promise<any>;
export declare function deleteIpAllowlist(orgId: string, actorId: string, id: string): Promise<void>;
export declare function resolveScimToken(rawToken: string): Promise<{
    tokenId: string;
    orgId: string;
} | null>;
export {};
//# sourceMappingURL=sso.d.ts.map