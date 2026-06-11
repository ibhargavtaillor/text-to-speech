/**
 * Generic, typed wrapper over chrome.storage areas. Callers get key-checked
 * reads/writes against a schema instead of stringly-typed `get('foo')`.
 *
 * We model the area through a minimal local interface (`RawArea`) rather than
 * `@types/chrome`'s heavily-overloaded `StorageArea`. The one boundary cast is
 * justified: it isolates the upstream typing friction to a single line and
 * leaves the public API fully type-safe.
 */
import type { SessionSchema, LocalSchema } from '@/types';

interface RawArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
}

function createArea<TSchema>(area: chrome.storage.StorageArea) {
  const raw = area as unknown as RawArea;
  return {
    async get<K extends keyof TSchema & string>(key: K): Promise<TSchema[K] | null> {
      const result = await raw.get(key);
      return (result[key] as TSchema[K] | undefined) ?? null;
    },
    async set<K extends keyof TSchema & string>(key: K, value: TSchema[K]): Promise<void> {
      await raw.set({ [key]: value });
    },
    async remove<K extends keyof TSchema & string>(key: K): Promise<void> {
      await raw.remove(key);
    },
  };
}

export const sessionStorage = createArea<SessionSchema>(chrome.storage.session);
export const localStorage = createArea<LocalSchema>(chrome.storage.local);
