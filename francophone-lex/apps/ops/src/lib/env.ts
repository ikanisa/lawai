import { config as loadEnv } from 'dotenv';

export interface LoadedEnv {
  values: Record<string, string>;
  missing: string[];
}

export function loadRequiredEnv(requiredKeys: string[]): LoadedEnv {
  loadEnv();

  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (value && value.length > 0) {
      values[key] = value;
    } else {
      missing.push(key);
    }
  }

  return { values, missing };
}

export function requireEnv(requiredKeys: string[]): Record<string, string> {
  const { values, missing } = loadRequiredEnv(requiredKeys);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
  }

  return values;
}
