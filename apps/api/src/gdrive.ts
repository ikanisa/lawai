import { createSign } from 'node:crypto';
import { randomUUID } from 'node:crypto';

type AccessToken = { access_token: string; token_type: string; expires_in: number };

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function getServiceAccountAccessToken(
  clientEmail: string,
  privateKeyPem: string,
  scope = 'https://www.googleapis.com/auth/drive.readonly',
): Promise<string> {
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
  const json = (await res.json()) as Partial<AccessToken> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'google_auth_failed');
  }
  return json.access_token;
}

export async function getStartPageToken(accessToken: string, driveId?: string | null): Promise<string> {
  const base = 'https://www.googleapis.com/drive/v3/changes/startPageToken';
  const url = new URL(base);
  url.searchParams.set('supportsAllDrives', 'true');
  if (driveId) url.searchParams.set('driveId', driveId);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { startPageToken?: string };
  if (!res.ok || !json.startPageToken) {
    throw new Error('google_start_page_token_failed');
  }
  return json.startPageToken;
}

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

export async function listChanges(
  accessToken: string,
  pageToken: string,
  pageSize = 25,
): Promise<{ changes: DriveChange[]; newStartPageToken?: string; nextPageToken?: string }> {
  const url = new URL('https://www.googleapis.com/drive/v3/changes');
  url.searchParams.set('pageToken', pageToken);
  url.searchParams.set('pageSize', String(Math.max(1, Math.min(pageSize, 1000))));
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set(
    'fields',
    'newStartPageToken,nextPageToken,changes(fileId,removed,time,file/id,file/name,file/mimeType,file/parents,file/md5Checksum,file/modifiedTime,file/driveId)',
  );
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json()) as {
    changes?: DriveChange[];
    newStartPageToken?: string;
    nextPageToken?: string;
  };
  if (!res.ok) {
    throw new Error('google_list_changes_failed');
  }
  return { changes: json.changes ?? [], newStartPageToken: json.newStartPageToken, nextPageToken: json.nextPageToken };
}

export async function getFileMetadata(accessToken: string, fileId: string): Promise<{ id: string; name: string; mimeType: string; parents?: string[] } | null> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,parents');
  url.searchParams.set('supportsAllDrives', 'true');
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; name: string; mimeType: string; parents?: string[] };
}

export async function downloadFile(accessToken: string, fileId: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('alt', 'media');
  url.searchParams.set('supportsAllDrives', 'true');
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const arrayBuf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return { data: new Uint8Array(arrayBuf), mimeType: contentType };
}

export async function exportGoogleDoc(
  accessToken: string,
  fileId: string,
  type: 'document' | 'spreadsheet' | 'presentation',
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  let mime: string;
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
  if (!res.ok) return null;
  const arrayBuf = await res.arrayBuffer();
  return { data: new Uint8Array(arrayBuf), mimeType: mime };
}

export function isGoogleDocMime(mimeType: string): 'document' | 'spreadsheet' | 'presentation' | null {
  if (mimeType === 'application/vnd.google-apps.document') return 'document';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'spreadsheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'presentation';
  return null;
}

export async function watchChanges(
  accessToken: string,
  pageToken: string,
  address: string,
  token?: string | null,
): Promise<{ id: string; resourceId: string; expiration?: string | null }> {
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
  const json = (await res.json()) as { id?: string; resourceId?: string; expiration?: string };
  if (!res.ok || !json.resourceId) {
    throw new Error('google_watch_failed');
  }
  return { id: channelId, resourceId: json.resourceId, expiration: json.expiration ?? null };
}

