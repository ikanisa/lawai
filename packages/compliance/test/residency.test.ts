import { describe, expect, it, vi } from 'vitest';
import { ensureResidencyAllowed, normaliseResidency, resolveResidencyZone } from '../src/residency.js';

describe('residency helpers', () => {
  it('normalises residency codes', () => {
    expect(normaliseResidency(' EU ')).toBe('eu');
    expect(normaliseResidency('\t')).toBeNull();
    expect(normaliseResidency(undefined)).toBeNull();
  });

  it('resolves zone with fallback and validation', () => {
    expect(
      resolveResidencyZone(null, { allowedZones: ['eu', 'ca'], fallbackZone: 'ca' }),
    ).toBe('ca');

    expect(() => resolveResidencyZone('br', { allowedZones: ['eu'], fallbackZone: 'eu' })).toThrowError(
      /residency_zone_restricted/,
    );
  });

  it('checks residency via Supabase RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(ensureResidencyAllowed({ rpc } as any, 'eu')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('storage_residency_allowed', { code: 'eu' });

    await expect(
      ensureResidencyAllowed({ rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } as any, 'eu'),
    ).rejects.toThrowError(/residency_zone_invalid/);

    await expect(
      ensureResidencyAllowed({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }) } as any, 'eu'),
    ).rejects.toThrowError(/residency_validation_failed:fail/);
  });
});
