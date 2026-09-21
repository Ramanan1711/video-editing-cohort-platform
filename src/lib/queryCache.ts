interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  tags?: string[];
}

class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();

  /**
   * Retrieve cached value if valid within TTL, or null if expired or missing.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Set a cached value with a specified TTL in milliseconds (default 5 minutes) and optional tags.
   */
  set<T>(key: string, data: T, ttlMs = 300_000, tags?: string[]): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
      tags,
    });
  }

  /**
   * Get cached data or execute the fetcher.
   * Supports tags for group invalidation and deduplicates concurrent in-flight fetches.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 300_000,
    tagsOrForceRefresh?: string[] | boolean,
    forceRefresh = false
  ): Promise<T> {
    const tags = Array.isArray(tagsOrForceRefresh) ? tagsOrForceRefresh : undefined;
    const shouldForce = typeof tagsOrForceRefresh === 'boolean' ? tagsOrForceRefresh : forceRefresh;

    if (!shouldForce) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Deduplicate in-flight promises
    const existingPromise = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingPromise) {
      return existingPromise;
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlMs, tags);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate entries matching an exact key, prefix, or tag.
   * Example: `queryCache.invalidate('cohorts')` will invalidate entries tagged with 'cohorts' or starting with 'cohorts'.
   */
  invalidate(keyOrTagOrPattern: string | RegExp): void {
    if (typeof keyOrTagOrPattern === 'string') {
      for (const [key, entry] of Array.from(this.store.entries())) {
        if (
          key === keyOrTagOrPattern ||
          key.startsWith(`${keyOrTagOrPattern}:`) ||
          key.startsWith(`${keyOrTagOrPattern}-`) ||
          (entry.tags && entry.tags.includes(keyOrTagOrPattern))
        ) {
          this.store.delete(key);
        }
      }
    } else {
      for (const [key, entry] of Array.from(this.store.entries())) {
        if (
          keyOrTagOrPattern.test(key) ||
          (entry.tags && entry.tags.some((t) => keyOrTagOrPattern.test(t)))
        ) {
          this.store.delete(key);
        }
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }
}

export const queryCache = new QueryCache();
