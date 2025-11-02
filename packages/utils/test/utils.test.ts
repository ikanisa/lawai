import { describe, expect, it } from 'vitest';

import { cn, spacing, spacingUnit } from '../src/index.js';

describe('cn', () => {
  it('merges class names and removes duplicates', () => {
    expect(cn('px-2 py-2', 'px-4', false && 'hidden')).toBe('py-2 px-4');
  });
});

describe('spacing', () => {
  it('calculates spacing from the base unit', () => {
    expect(spacing(2)).toBe(`${(spacingUnit * 2) / 16}rem`);
  });
});
