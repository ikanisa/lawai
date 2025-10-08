import { beforeEach, describe, expect, it, vi } from 'vitest';
const tableMocks = {};
vi.mock('../src/config.js', () => ({
    env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    },
}));
const auditMock = vi.fn(async () => { });
vi.mock('../src/audit.js', () => ({
    logAuditEvent: auditMock,
}));
const randomBytesMock = vi.fn(() => Buffer.from('0123456789abcdef0123456789abcdef'));
vi.mock('node:crypto', async () => {
    const actual = await vi.importActual('node:crypto');
    return {
        ...actual,
        randomBytes: randomBytesMock,
    };
});
vi.mock('@avocat-ai/supabase', () => ({
    createServiceClient: vi.fn(() => ({
        from: (table) => {
            const factory = tableMocks[table];
            if (!factory) {
                throw new Error(`No mock for table ${table}`);
            }
            return factory();
        },
    })),
}));
beforeEach(() => {
    Object.keys(tableMocks).forEach((key) => delete tableMocks[key]);
    auditMock.mockClear();
    randomBytesMock.mockClear();
});
describe('sso helpers', () => {
    it('creates a new SSO connection with a sanitized role', async () => {
        const insertedRow = {
            id: 'conn-1',
            org_id: 'org-1',
            provider: 'saml',
            label: 'Acme',
            metadata: {},
            acs_url: null,
            entity_id: null,
            client_id: null,
            default_role: 'member',
            group_mappings: {},
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
        };
        const maybeSingle = vi.fn(async () => ({ data: insertedRow, error: null }));
        const selectMock = vi.fn(() => ({ maybeSingle }));
        const insertMock = vi.fn(() => ({ select: selectMock }));
        tableMocks['sso_connections'] = () => ({ insert: insertMock });
        const { upsertSsoConnection } = await import('../src/sso.js');
        const result = await upsertSsoConnection('org-1', 'user-1', {
            provider: 'saml',
            defaultRole: 'invalid-role',
            label: 'Acme',
        });
        expect(insertMock).toHaveBeenCalledTimes(1);
        const payload = insertMock.mock.calls[0][0];
        expect(payload.default_role).toBe('member');
        expect(result?.defaultRole).toBe('member');
        expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sso.created', object: 'conn-1' }));
    });
    it('creates a SCIM token and stores the hashed secret', async () => {
        const insertedRow = {
            id: 'token-1',
            name: 'Provisioning',
            created_at: '2024-01-01T00:00:00.000Z',
            expires_at: null,
        };
        const maybeSingle = vi.fn(async () => ({ data: insertedRow, error: null }));
        const selectMock = vi.fn(() => ({ maybeSingle }));
        const insertMock = vi.fn(() => ({ select: selectMock }));
        tableMocks['scim_tokens'] = () => ({ insert: insertMock });
        const { createScimToken } = await import('../src/sso.js');
        const result = await createScimToken('org-1', 'user-1', 'Provisioning');
        expect(randomBytesMock).toHaveBeenCalledWith(32);
        const { createHash } = await import('node:crypto');
        const rawBuffer = Buffer.from('0123456789abcdef0123456789abcdef');
        const expectedToken = rawBuffer.toString('base64url');
        const expectedHash = createHash('sha256').update(expectedToken).digest('hex');
        const payload = insertMock.mock.calls[0][0];
        expect(payload.token_hash).toBe(expectedHash);
        expect(result.token).toBe(expectedToken);
        expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'scim.token.created', object: 'token-1' }));
    });
    it('returns null for expired SCIM tokens', async () => {
        const maybeSingle = vi.fn(async () => ({
            data: { id: 'token-1', org_id: 'org-1', expires_at: '2000-01-01T00:00:00.000Z' },
            error: null,
        }));
        const eqMock = vi.fn(() => ({ maybeSingle }));
        const selectMock = vi.fn(() => ({ eq: eqMock }));
        const updateMock = vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: null })) }));
        tableMocks['scim_tokens'] = () => ({ select: selectMock, update: updateMock });
        const { resolveScimToken } = await import('../src/sso.js');
        const result = await resolveScimToken('raw-token');
        expect(result).toBeNull();
        expect(updateMock).not.toHaveBeenCalled();
        const { createHash } = await import('node:crypto');
        const expectedHash = createHash('sha256').update('raw-token').digest('hex');
        expect(eqMock).toHaveBeenCalledWith('token_hash', expectedHash);
    });
    it('returns context for active SCIM tokens and updates last_used_at', async () => {
        const maybeSingle = vi.fn(async () => ({
            data: { id: 'token-2', org_id: 'org-9', expires_at: null },
            error: null,
        }));
        const eqMock = vi.fn(() => ({ maybeSingle }));
        const selectMock = vi.fn(() => ({ eq: eqMock }));
        const updateEqMock = vi.fn(async () => ({ data: null, error: null }));
        const updateMock = vi.fn(() => ({ eq: updateEqMock }));
        tableMocks['scim_tokens'] = () => ({ select: selectMock, update: updateMock });
        const { resolveScimToken } = await import('../src/sso.js');
        const result = await resolveScimToken('active-token');
        expect(result).toEqual({ tokenId: 'token-2', orgId: 'org-9' });
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateEqMock).toHaveBeenCalledWith('id', 'token-2');
    });
});
