import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

const OTP_LENGTH = 6;
const KEY_LENGTH = 32;

export function generateOtp(length: number = OTP_LENGTH): string {
  const max = 10 ** length;
  const value = randomInt(0, max);
  return value.toString().padStart(length, '0');
}

export async function hashOtp(otp: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = scryptSync(otp, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  try {
    const [saltHex, derivedHex] = hash.split(':');
    if (!saltHex || !derivedHex) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(derivedHex, 'hex');
    const actual = scryptSync(otp, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const OTP_POLICY = {
  length: OTP_LENGTH,
  ttlMinutes: 10,
  maxAttempts: 5,
};
