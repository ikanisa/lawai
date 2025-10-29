import { createSign } from 'node:crypto';
import { randomUUID } from 'node:crypto';
function base64url(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
export async function getServiceAccountAccessToken(clientEmail, privateKeyPem, scope = 'https://www.googleapis.com/auth/drive.readonly') {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1h
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: clientEmail,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat,
        exp,
    };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKeyPem);
    const jwt = `${signingInput}.${base64url(signature)}`;
    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const json = (await res.json());
    if (!res.ok || !json.access_token) {
        throw new Error(json.error_description || json.error || 'google_auth_failed');
    }
    return json.access_token;
}
export async function getStartPageToken(accessToken, driveId) {
    const base = 'https://www.googleapis.com/drive/v3/changes/startPageToken';
    const url = new URL(base);
    url.searchParams.set('supportsAllDrives', 'true');
    if (driveId)
        url.searchParams.set('driveId', driveId);
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json());
    if (!res.ok || !json.startPageToken) {
        throw new Error('google_start_page_token_failed');
    }
    return json.startPageToken;
}
export async function listChanges(accessToken, pageToken, pageSize = 25) {
    const url = new URL('https://www.googleapis.com/drive/v3/changes');
    url.searchParams.set('pageToken', pageToken);
    url.searchParams.set('pageSize', String(Math.max(1, Math.min(pageSize, 1000))));
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('fields', 'newStartPageToken,nextPageToken,changes(fileId,removed,time,file/id,file/name,file/mimeType,file/parents,file/md5Checksum,file/modifiedTime,file/driveId)');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json());
    if (!res.ok) {
        throw new Error('google_list_changes_failed');
    }
    return { changes: json.changes ?? [], newStartPageToken: json.newStartPageToken, nextPageToken: json.nextPageToken };
}
export async function getFileMetadata(accessToken, fileId) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
    url.searchParams.set('fields', 'id,name,mimeType,parents');
    url.searchParams.set('supportsAllDrives', 'true');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok)
        return null;
    return (await res.json());
}
export async function downloadFile(accessToken, fileId) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
    url.searchParams.set('alt', 'media');
    url.searchParams.set('supportsAllDrives', 'true');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok)
        return null;
    const arrayBuf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return { data: new Uint8Array(arrayBuf), mimeType: contentType };
}
export async function exportGoogleDoc(accessToken, fileId, type) {
    let mime;
    switch (type) {
        case 'document':
            mime = 'text/html';
            break;
        case 'spreadsheet':
            mime = 'text/csv';
            break;
        default:
            mime = 'application/pdf';
            break;
    }
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`);
    url.searchParams.set('mimeType', mime);
    url.searchParams.set('supportsAllDrives', 'true');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok)
        return null;
    const arrayBuf = await res.arrayBuffer();
    return { data: new Uint8Array(arrayBuf), mimeType: mime };
}
export function isGoogleDocMime(mimeType) {
    if (mimeType === 'application/vnd.google-apps.document')
        return 'document';
    if (mimeType === 'application/vnd.google-apps.spreadsheet')
        return 'spreadsheet';
    if (mimeType === 'application/vnd.google-apps.presentation')
        return 'presentation';
    return null;
}
export async function watchChanges(accessToken, pageToken, address, token) {
    const url = new URL('https://www.googleapis.com/drive/v3/changes/watch');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('pageToken', pageToken);
    const channelId = randomUUID();
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: channelId, type: 'web_hook', address, token: token ?? undefined }),
    });
    const json = (await res.json());
    if (!res.ok || !json.resourceId) {
        throw new Error('google_watch_failed');
    }
    return { id: channelId, resourceId: json.resourceId, expiration: json.expiration ?? null };
}
