import { beforeEach, describe, expect, it, vi } from 'vitest';

const tableMocks: Record<string, () => any> = {};

vi.mock('../src/config.js', () => ({
  env: {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  },
}));

const auditMock = vi.fn(async () => {});
vi.mock('../src/audit.js', () => ({
  logAuditEvent: auditMock,
}));

const resolveScimTokenMock = vi.fn(async () => ({ tokenId: 'token-1', orgId: 'org-1' }));
vi.mock('../src/sso.js', () => ({
  resolveScimToken: resolveScimTokenMock,
}));

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: (table: string) => {
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
  resolveScimTokenMock.mockClear();
});

describe('scim helpers', () => {
  it('creates a SCIM user with normalized role', async () => {
    const profileUpsert = vi.fn(async () => ({ error: null }));
    tableMocks['profiles'] = () => ({ upsert: profileUpsert });

    const memberRow = {
      user_id: 'user-1',
      role: 'owner',
      created_at: '2024-01-01T00:00:00.000Z',
      profiles: { email: 'lawyer@example.com', full_name: 'Maître Exemple', updated_at: '2024-01-01T00:00:00.000Z' },
    };
    const maybeSingle = vi.fn(async () => ({ data: memberRow, error: null }));
    const selectMock = vi.fn(() => ({ maybeSingle }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    tableMocks['org_members'] = () => ({ upsert: upsertMock });

    const { createScimUser } = await import('../src/scim.js');
    const payload = {
      id: 'user-1',
      emails: [{ value: 'lawyer@example.com', primary: true }],
      roles: [{ value: 'OWNER' }],
      displayName: 'Maître Exemple',
    };

    const result = await createScimUser('Bearer secret-token', payload);

    expect(resolveScimTokenMock).toHaveBeenCalledWith('secret-token');
    expect(profileUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      email: 'lawyer@example.com',
      full_name: 'Maître Exemple',
      updated_at: expect.any(String),
    });
    expect(upsertMock).toHaveBeenCalledWith({ org_id: 'org-1', user_id: 'user-1', role: 'owner' });
    expect(result.userName).toBe('lawyer@example.com');
    expect(result.roles?.[0]?.value).toBe('owner');
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'scim.user.created', object: 'user-1' }),
    );
  });

  it('lists SCIM users for an organization', async () => {
    const rows = [
      {
        user_id: 'user-1',
        role: 'member',
        created_at: '2024-01-01T00:00:00.000Z',
        profiles: { email: 'member@example.com', full_name: 'Member Example', updated_at: '2024-01-02T00:00:00.000Z' },
      },
    ];
    const orderMock = vi.fn(async () => ({ data: rows, error: null }));
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    tableMocks['org_members'] = () => ({ select: selectMock });

    const { listScimUsers } = await import('../src/scim.js');
    const response = await listScimUsers('Bearer token-value');

    expect(resolveScimTokenMock).toHaveBeenCalledWith('token-value');
    expect(eqMock).toHaveBeenCalledWith('org_id', 'org-1');
    expect(response.Resources).toHaveLength(1);
    expect(response.Resources[0].userName).toBe('member@example.com');
  });
});
