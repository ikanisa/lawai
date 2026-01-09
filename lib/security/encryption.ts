/**
 * Security & Encryption Utilities
 * Provides data encryption for sensitive information
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Derive encryption key from password
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypt sensitive data
 */
export async function encryptData(
  data: string,
  encryptionKey: string = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
): Promise<string> {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = await deriveKey(encryptionKey, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    const result = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };

    return JSON.stringify(result);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export async function decryptData(
  encryptedData: string,
  encryptionKey: string = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
): Promise<string> {
  try {
    const data = JSON.parse(encryptedData);
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    const encrypted = data.encrypted;

    const key = await deriveKey(encryptionKey, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt PII (Personally Identifiable Information)
 */
export async function encryptPII(pii: string): Promise<string> {
  const piiKey = process.env.PII_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key';
  return encryptData(pii, piiKey);
}

/**
 * Decrypt PII
 */
export async function decryptPII(encryptedPII: string): Promise<string> {
  const piiKey = process.env.PII_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key';
  return decryptData(encryptedPII, piiKey);
}

/**
 * Check if data contains PII patterns
 */
export function containsPII(text: string): boolean {
  // Simple PII detection patterns (in production, use more sophisticated detection)
  const patterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{3}\.\d{3}\.\d{4}\b/, // Phone
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{16}\b/, // Credit card
  ];

  return patterns.some((pattern) => pattern.test(text));
}
