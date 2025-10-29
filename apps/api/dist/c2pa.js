// @ts-nocheck
import { createPrivateKey, randomUUID, sign as signMessage } from 'node:crypto';
import { env } from './config.js';
const FALLBACK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIIAtRVuGZ79Bs4MTIJvOLLmObAun1vDLteA94ppWKqhB
-----END PRIVATE KEY-----`;
const FALLBACK_KEY_ID = 'dev-ed25519';
let cachedKey = null;
function getPrivateKey() {
    if (cachedKey) {
        return cachedKey;
    }
    const pem = env.C2PA_SIGNING_PRIVATE_KEY ?? FALLBACK_PRIVATE_KEY;
    cachedKey = createPrivateKey({ key: pem, format: 'pem' });
    return cachedKey;
}
function getKeyId() {
    return env.C2PA_SIGNING_KEY_ID ?? FALLBACK_KEY_ID;
}
export function signC2PA({ orgId, userId, contentSha256, filename }) {
    if (!contentSha256 || contentSha256.length !== 64 || /[^a-f0-9]/i.test(contentSha256)) {
        throw new Error('invalid_sha256');
    }
    const key = getPrivateKey();
    const keyId = getKeyId();
    const signedAt = new Date().toISOString();
    const statementId = randomUUID();
    const manifest = {
        '@context': 'https://schema.c2pa.org/manifest.json',
        version: '1.3.0',
        claim_generator: 'avocat-ai/exporter',
        statement_id: statementId,
        signed_at: signedAt,
        assertions: [
            {
                label: 'c2pa.hash',
                digest: { algorithm: 'sha256', value: contentSha256.toLowerCase() },
                filename: filename ?? null,
            },
        ],
        subject: { org: orgId, user: userId },
    };
    const payload = Buffer.from(JSON.stringify(manifest));
    const signature = signMessage(null, payload, key).toString('base64');
    return {
        keyId,
        signedAt,
        algorithm: 'ed25519',
        signature,
        statementId,
        manifest,
    };
}
