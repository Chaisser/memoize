// ===== TYPES =====

export interface MemoOptions {
  ttl?: number;
  maxSize?: number;
  resolver?: (...args: unknown[]) => string;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface MemoizedCache<T> {
  cache: Map<string, CacheEntry<T>>;
}

export interface MemoizedAsyncCache<T> {
  cache: Map<string, CacheEntry<T>>;
  pending: Map<string, Promise<T>>;
}

export interface MemoizedWithStats<T> {
  cache: Map<string, CacheEntry<T>>;
  stats(): MemoStats;
}

export interface MemoizedDebounce<T> {
  cache: Map<string, CacheEntry<T>>;
  cancel(): void;
}

export interface MemoStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

// ===== KEY SERIALIZATION =====

export function defaultResolver(...args: unknown[]): string {
  if (args.length === 0) return '__no_args__';
  if (args.length === 1) {
    const a = args[0];
    if (a === null) return 'null';
    if (a === undefined) return 'undefined';
    if (typeof a === 'object') return JSON.stringify(a);
    return String(a);
  }
  return JSON.stringify(args);
}

// ===== CORE MEMOIZE =====

export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: MemoOptions = {}
): T & MemoizedCache<ReturnType<T>> {
  const {
    ttl = Infinity,
    maxSize = Infinity,
    resolver = defaultResolver,
  } = options;

  const cache = new Map<string, CacheEntry<ReturnType<T>>>();

  const memoized = function (this: unknown, ...args: unknown[]): ReturnType<T> {
    const key = resolver(...args);
    const now = Date.now();
    const entry = cache.get(key);

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    const result = fn.apply(this, args) as ReturnType<T>;

    if (cache.size >= maxSize && !cache.has(key)) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }

    cache.set(key, {
      value: result,
      expiresAt: ttl === Infinity ? Infinity : now + ttl,
    });

    return result;
  } as T & MemoizedCache<ReturnType<T>>;

  memoized.cache = cache;
  return memoized;
}

// ===== MEMOIZE WITH TTL =====

export function memoizeWithTTL<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttl: number,
  resolver?: (...args: unknown[]) => string
): T & MemoizedCache<ReturnType<T>> {
  return memoize(fn, { ttl, resolver });
}

// ===== MEMOIZE WITH LIMIT =====

export function memoizeWithLimit<T extends (...args: unknown[]) => unknown>(
  fn: T,
  maxSize: number,
  resolver?: (...args: unknown[]) => string
): T & MemoizedCache<ReturnType<T>> {
  return memoize(fn, { maxSize, resolver });
}

// ===== MEMO MAP (explicit cache control) =====

export class MemoMap<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;
  private maxSize: number;

  constructor(options: { ttl?: number; maxSize?: number } = {}) {
    this.ttl = options.ttl ?? Infinity;
    this.maxSize = options.maxSize ?? Infinity;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: this.ttl === Infinity ? Infinity : Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    this.evictExpired();
    return this.cache.size;
  }

  keys(): string[] {
    this.evictExpired();
    return [...this.cache.keys()];
  }

  values(): T[] {
    this.evictExpired();
    return [...this.cache.values()].map(e => e.value);
  }

  entries(): Array<[string, T]> {
    this.evictExpired();
    return [...this.cache.entries()].map(([k, e]) => [k, e.value]);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}

// ===== ASYNC MEMOIZE =====

export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: MemoOptions = {}
): T & MemoizedAsyncCache<Awaited<ReturnType<T>>> {
  const {
    ttl = Infinity,
    maxSize = Infinity,
    resolver = defaultResolver,
  } = options;

  const cache = new Map<string, CacheEntry<Awaited<ReturnType<T>>>>();
  const pending = new Map<string, Promise<Awaited<ReturnType<T>>>>();

  const memoized = async function (
    this: unknown,
    ...args: unknown[]
  ): Promise<Awaited<ReturnType<T>>> {
    const key = resolver(...args);
    const now = Date.now();
    const entry = cache.get(key);

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    const existingPending = pending.get(key);
    if (existingPending) return existingPending;

    const promise = Promise.resolve(fn.apply(this, args)).then(result => {
      if (cache.size >= maxSize && !cache.has(key)) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      cache.set(key, {
        value: result as Awaited<ReturnType<T>>,
        expiresAt: ttl === Infinity ? Infinity : now + ttl,
      });
      pending.delete(key);
      return result as Awaited<ReturnType<T>>;
    });

    pending.set(key, promise);
    return promise;
  } as T & MemoizedAsyncCache<Awaited<ReturnType<T>>>;

  memoized.cache = cache;
  memoized.pending = pending;
  return memoized;
}

// ===== MEMOIZE WITH STATS =====

export function memoizeWithStats<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: MemoOptions = {}
): T & MemoizedWithStats<ReturnType<T>> {
  const {
    ttl = Infinity,
    maxSize = Infinity,
    resolver = defaultResolver,
  } = options;

  const cache = new Map<string, CacheEntry<ReturnType<T>>>();
  let hits = 0;
  let misses = 0;

  const memoized = function (this: unknown, ...args: unknown[]): ReturnType<T> {
    const key = resolver(...args);
    const now = Date.now();
    const entry = cache.get(key);

    if (entry && entry.expiresAt > now) {
      hits++;
      return entry.value;
    }

    misses++;
    const result = fn.apply(this, args) as ReturnType<T>;

    if (cache.size >= maxSize && !cache.has(key)) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }

    cache.set(key, {
      value: result,
      expiresAt: ttl === Infinity ? Infinity : now + ttl,
    });

    return result;
  } as T & MemoizedWithStats<ReturnType<T>>;

  memoized.cache = cache;
  memoized.stats = () => {
    const total = hits + misses;
    return {
      hits,
      misses,
      hitRate: total === 0 ? 0 : hits / total,
      size: cache.size,
    };
  };

  return memoized;
}

// ===== WEAK MEMOIZE (for object args) =====

export function weakMemoize<T extends (...args: [object, ...unknown[]]) => unknown>(
  fn: T
): T & { cache: WeakMap<object, CacheEntry<ReturnType<T>>> } {
  const cache = new WeakMap<object, CacheEntry<ReturnType<T>>>();

  const memoized = function (this: unknown, ...args: [object, ...unknown[]]): ReturnType<T> {
    const obj = args[0];
    const entry = cache.get(obj);
    if (entry) return entry.value;

    const result = fn.apply(this, args) as ReturnType<T>;
    cache.set(obj, { value: result, expiresAt: Infinity });
    return result;
  } as T & { cache: WeakMap<object, CacheEntry<ReturnType<T>>> };

  memoized.cache = cache;
  return memoized;
}

// ===== DEBOUNCE MEMOIZE (cache result for a debounce period) =====

export function memoizeDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  resolver?: (...args: unknown[]) => string
): T & MemoizedDebounce<ReturnType<T>> {
  const keyResolver = resolver ?? defaultResolver;
  const cache = new Map<string, CacheEntry<ReturnType<T>>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const memoized = function (this: unknown, ...args: unknown[]): ReturnType<T> {
    const key = keyResolver(...args);

    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value;
    }

    const result = fn.apply(this, args) as ReturnType<T>;
    cache.set(key, { value: result, expiresAt: Date.now() + delay });

    const existingTimer = timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    timers.set(key, setTimeout(() => {
      cache.delete(key);
      timers.delete(key);
    }, delay));

    return result;
  } as T & MemoizedDebounce<ReturnType<T>>;

  memoized.cache = cache;
  memoized.cancel = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    cache.clear();
  };

  return memoized;
}

// ===== UTILITY: CLEAR CACHE =====

export function clearCache<T>(fn: T & MemoizedCache<unknown>): void {
  fn.cache.clear();
}

// ===== UTILITY: CACHE SIZE =====

export function cacheSize<T>(fn: T & MemoizedCache<unknown>): number {
  return fn.cache.size;
}
