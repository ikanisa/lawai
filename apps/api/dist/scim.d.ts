interface ScimRoleEntry {
    value?: string | null;
}
interface ScimEmailEntry {
    value?: string | null;
    primary?: boolean | null;
}
interface ScimEnterpriseExtension {
    roles?: ScimRoleEntry[] | null;
}
interface ScimName {
    formatted?: string | null;
    givenName?: string | null;
    familyName?: string | null;
}
export interface ScimUserPayload {
    id?: string;
    roles?: ScimRoleEntry[] | null;
    role?: string | null;
    emails?: ScimEmailEntry[] | null;
    email?: string | null;
    displayName?: string | null;
    name?: ScimName | null;
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'?: ScimEnterpriseExtension | null;
}
interface ScimPatchOperation {
    op?: string;
    path?: string;
    value?: unknown;
    Value?: unknown;
}
export interface ScimPatchRequest {
    Operations?: ScimPatchOperation[];
}
export declare function listScimUsers(authHeader: string): Promise<{
    schemas: string[];
    totalResults: any;
    itemsPerPage: any;
    startIndex: number;
    Resources: any;
}>;
export declare function createScimUser(authHeader: string, payload: ScimUserPayload): Promise<{
    schemas: string[];
    id: string;
    userName: string;
    active: boolean;
    name: {
        formatted: string;
    };
    emails: {
        value: string;
        primary: boolean;
    }[];
    roles: {
        value: string;
    }[];
    meta: {
        resourceType: string;
        created: string;
        lastModified: string;
    };
}>;
export declare function patchScimUser(authHeader: string, userId: string, payload: ScimPatchRequest): Promise<{
    schemas: string[];
    id: string;
    userName: string;
    active: boolean;
    name: {
        formatted: string;
    };
    emails: {
        value: string;
        primary: boolean;
    }[];
    roles: {
        value: string;
    }[];
    meta: {
        resourceType: string;
        created: string;
        lastModified: string;
    };
} | {
    schemas: string[];
    id: string;
    active: boolean;
}>;
export declare function deleteScimUser(authHeader: string, userId: string): Promise<{
    status: string;
}>;
export {};
//# sourceMappingURL=scim.d.ts.map