import { describe, expect, it } from 'vitest';
import { makeStoragePath } from '../src/storage.js';

describe('makeStoragePath', () => {
  it('builds a namespaced path including residency zone and timestamp segments', () => {
    const now = new Date('2025-03-15T12:34:56.000Z');
    const path = makeStoragePath('11111111-2222-3333-4444-555555555555', 'EU', ' Rapport Final.pdf ', now);
    expect(path).toBe('11111111-2222-3333-4444-555555555555/eu/2025/03/rapport-final.pdf');
  });

  it('normalises filenames that contain special characters', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const path = makeStoragePath('org', 'rw', 'Décision: #42?.md', now);
    expect(path).toBe('org/rw/2024/01/d-cision-42-.md');
  });

  it('falls back to a default filename when the input is empty', () => {
    const now = new Date('2024-06-10T00:00:00.000Z');
    const path = makeStoragePath('org', 'maghreb', '   ', now);
    expect(path).toBe('org/maghreb/2024/06/document');
  });

  it('throws when residency zone is missing', () => {
    expect(() => makeStoragePath('org', '', 'file.pdf')).toThrow(/residency_zone_required/);
  });
});
