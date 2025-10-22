/**
 * Minimal runtime configuration shim for non-Vercel environments.
 * Extend this module with values sourced from your preferred configuration store.
 */
export type RuntimeConfig = Record<string, unknown>;

let cachedConfig: RuntimeConfig | null = null;

const runtimeConfigContainer = globalThis as typeof globalThis & {
  __runtimeConfig__?: RuntimeConfig;
};

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = runtimeConfigContainer.__runtimeConfig__ ?? {};
  return cachedConfig;
}

export function setRuntimeConfig(config: RuntimeConfig): void {
  cachedConfig = config;
  runtimeConfigContainer.__runtimeConfig__ = config;
}
