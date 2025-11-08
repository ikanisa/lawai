/**
 * Configuration utility for accessing environment variables
 * Provides a simple interface for config management
 */

/**
 * Get a configuration value from environment variables
 * Converts key from kebab-case/dot notation to UPPER_SNAKE_CASE
 * @param key Configuration key
 * @returns Configuration value or null if not found
 */
export async function getConfig(key: string) {
  return process.env[key.toUpperCase().replace(/[.-]/g, '_')] || null;
}

/**
 * Configuration object with common app settings
 */
export const config = {
  get: getConfig,
  app: {
    name: 'Avocat AI',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://avocat-ai.netlify.app',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
};
