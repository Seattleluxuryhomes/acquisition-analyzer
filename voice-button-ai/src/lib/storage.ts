/**
 * Local-first storage layer.
 *
 * Uses chrome.storage.local when running inside an extension, otherwise falls
 * back to window.localStorage. The API is intentionally tiny and synchronous-
 * feeling (get returns a cached value) so the rest of the app stays simple.
 * Designed so a Supabase / cloud sync adapter can be dropped in later behind
 * the same get/set surface.
 */

const PREFIX = 'vbai:';

type Json = unknown;

const hasChromeStorage =
  typeof chrome !== 'undefined' && !!chrome?.storage?.local;

/** In-memory mirror so reads are synchronous even with chrome.storage. */
const cache = new Map<string, Json>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, raw: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* quota or unavailable — ignore, cache still holds the value */
  }
  if (hasChromeStorage) {
    try {
      chrome.storage.local.set({ [PREFIX + key]: raw });
    } catch {
      /* ignore */
    }
  }
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (cache.has(key)) return cache.get(key) as T;
    const raw = read(key);
    if (raw == null) {
      cache.set(key, fallback);
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      cache.set(key, parsed);
      return parsed;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    cache.set(key, value);
    write(key, JSON.stringify(value));
  },

  /** Hydrate the cache from chrome.storage.local (async, best-effort). */
  async hydrateFromChrome(): Promise<void> {
    if (!hasChromeStorage) return;
    try {
      const all = await chrome.storage.local.get(null);
      for (const [k, v] of Object.entries(all)) {
        if (!k.startsWith(PREFIX)) continue;
        const key = k.slice(PREFIX.length);
        if (typeof v === 'string') {
          try {
            cache.set(key, JSON.parse(v));
            window.localStorage.setItem(k, v);
          } catch {
            /* ignore malformed */
          }
        }
      }
    } catch {
      /* ignore */
    }
  },
};

export const KEYS = {
  favorites: 'favorites',
  recents: 'recents',
  usage: 'usage',
  history: 'history',
  theme: 'theme',
  settings: 'settings',
  learning: 'learning',
  insights: 'insights',
} as const;
