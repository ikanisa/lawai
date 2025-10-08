import { describe, expect, it } from 'vitest';
import { generateOtp, hashOtp, verifyOtp, OTP_POLICY } from '../src/otp';

describe('OTP helpers', () => {
  it('generates numeric codes with fixed length', () => {
    for (let i = 0; i < 10; i += 1) {
      const code = generateOtp();
      expect(code).toHaveLength(OTP_POLICY.length);
      expect(/^[0-9]+$/.test(code)).toBe(true);
    }
  });

  it('hashes and verifies codes', async () => {
    const code = generateOtp();
    const hash = await hashOtp(code);
    expect(await verifyOtp(code, hash)).toBe(true);
    expect(await verifyOtp('000000', hash)).toBe(false);
  });

  it('returns false when hash format is invalid', async () => {
    expect(await verifyOtp('123456', 'not-a-hash')).toBe(false);
    expect(await verifyOtp('123456', 'salt-only:')).toBe(false);
  });
});
