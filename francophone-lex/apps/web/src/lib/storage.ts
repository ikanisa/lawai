/**
 * Storage shim that replaces Vercel KV/Blob utilities with an overridable interface.
 */
export interface KeyValueStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

class MemoryStore implements KeyValueStore {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let adapter: KeyValueStore = new MemoryStore();

export function configureStore(customStore: KeyValueStore) {
  adapter = customStore;
}

export const storage = {
  get: <T = unknown>(key: string) => adapter.get<T>(key),
  set: <T = unknown>(key: string, value: T) => adapter.set<T>(key, value),
  delete: (key: string) => adapter.delete(key),
};
