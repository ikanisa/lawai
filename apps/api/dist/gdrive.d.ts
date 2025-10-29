export declare function getServiceAccountAccessToken(clientEmail: string, privateKeyPem: string, scope?: string): Promise<string>;
export declare function getStartPageToken(accessToken: string, driveId?: string | null): Promise<string>;
export type DriveChange = {
    fileId?: string;
    removed?: boolean;
    time?: string;
    file?: {
        id?: string;
        name?: string;
        mimeType?: string;
        parents?: string[];
        md5Checksum?: string;
        modifiedTime?: string;
        driveId?: string;
    };
};
export declare function listChanges(accessToken: string, pageToken: string, pageSize?: number): Promise<{
    changes: DriveChange[];
    newStartPageToken?: string;
    nextPageToken?: string;
}>;
export declare function getFileMetadata(accessToken: string, fileId: string): Promise<{
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
} | null>;
export declare function downloadFile(accessToken: string, fileId: string): Promise<{
    data: Uint8Array;
    mimeType: string;
} | null>;
export declare function exportGoogleDoc(accessToken: string, fileId: string, type: 'document' | 'spreadsheet' | 'presentation'): Promise<{
    data: Uint8Array;
    mimeType: string;
} | null>;
export declare function isGoogleDocMime(mimeType: string): 'document' | 'spreadsheet' | 'presentation' | null;
export declare function watchChanges(accessToken: string, pageToken: string, address: string, token?: string | null): Promise<{
    id: string;
    resourceId: string;
    expiration?: string | null;
}>;
//# sourceMappingURL=gdrive.d.ts.map