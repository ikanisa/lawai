import { createClient } from '@supabase/supabase-js';

/**
 * Cache manager using Supabase as backend storage
 * Provides simple key-value caching with TTL support
 */
class CacheManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found or expired
   */
  async get(key: string) {
    try {
      const { data } = await this.supabase
        .from('cache')
        .select('value, expires_at')
        .eq('key', key)
        .single();

      if (!data || new Date(data.expires_at) < new Date()) {
        return null;
      }

      return JSON.parse(data.value);
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   * @param key Cache key
   * @param value Value to cache (will be JSON serialized)
   * @param ttl Time to live in seconds (default: 3600)
   */
  async set(key: string, value: any, ttl = 3600) {
    await this.supabase.from('cache').upsert({
      key,
      value: JSON.stringify(value),
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  }

  /**
   * Delete a value from cache
   * @param key Cache key to delete
   */
  async del(key: string) {
    await this.supabase.from('cache').delete().eq('key', key);
  }
}

export const cache = new CacheManager();
