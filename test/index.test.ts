import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  memoize,
  memoizeWithTTL,
  memoizeWithLimit,
  MemoMap,
  memoizeAsync,
  memoizeWithStats,
  weakMemoize,
  memoizeDebounce,
  defaultResolver,
  clearCache,
  cacheSize,
} from '../src/index';

describe('@chaisser/memoize', () => {
  // ===== DEFAULT RESOLVER =====

  describe('defaultResolver', () => {
    it('returns __no_args__ for no arguments', () => {
      expect(defaultResolver()).toBe('__no_args__');
    });

    it('serializes a single primitive', () => {
      expect(defaultResolver(42)).toBe('42');
      expect(defaultResolver('hello')).toBe('hello');
      expect(defaultResolver(true)).toBe('true');
    });

    it('serializes null and undefined', () => {
      expect(defaultResolver(null)).toBe('null');
      expect(defaultResolver(undefined)).toBe('undefined');
    });

    it('serializes objects', () => {
      expect(defaultResolver({ a: 1 })).toBe('{"a":1}');
    });

    it('serializes multiple args', () => {
      expect(defaultResolver(1, 'a', true)).toBe('[1,"a",true]');
    });
  });

  // ===== CORE MEMOIZE =====

  describe('memoize', () => {
    it('caches results by arguments', () => {
      let calls = 0;
      const fn = memoize((x: unknown) => { calls++; return (x as number) * 2; });

      expect(fn(2)).toBe(4);
      expect(fn(2)).toBe(4);
      expect(calls).toBe(1);
    });

    it('caches different arguments separately', () => {
      let calls = 0;
      const fn = memoize((x: unknown) => { calls++; return (x as number) * 2; });

      fn(2);
      fn(3);
      expect(calls).toBe(2);
    });

    it('exposes the cache', () => {
      const fn = memoize((x: unknown) => x);
      fn(1);
      fn(2);
      expect(fn.cache.size).toBe(2);
    });

    it('uses custom resolver', () => {
      let calls = 0;
      const fn = memoize(
        (obj: unknown) => { calls++; return (obj as { x: number }).x; },
        { resolver: (obj: unknown) => String((obj as { x: number }).x) }
      );

      fn({ x: 1 });
      fn({ x: 1 });
      expect(calls).toBe(1);
    });

    it('preserves this context', () => {
      const obj = {
        multiplier: 10,
        compute: memoize(function (this: { multiplier: number }, x: unknown) {
          return (x as number) * this.multiplier;
        }),
      };

      expect(obj.compute(5)).toBe(50);
      expect(obj.compute(5)).toBe(50);
    });
  });

  // ===== MEMOIZE WITH TTL =====

  describe('memoizeWithTTL', () => {
    it('caches within TTL', () => {
      let calls = 0;
      const fn = memoizeWithTTL((x: unknown) => { calls++; return x; }, 5000);

      fn(1);
      fn(1);
      expect(calls).toBe(1);
    });

    it('recomputes after TTL expires', async () => {
      vi.useFakeTimers();
      let calls = 0;
      const fn = memoizeWithTTL((x: unknown) => { calls++; return x; }, 100);

      fn(1);
      expect(calls).toBe(1);

      vi.advanceTimersByTime(150);

      fn(1);
      expect(calls).toBe(2);

      vi.useRealTimers();
    });
  });

  // ===== MEMOIZE WITH LIMIT =====

  describe('memoizeWithLimit', () => {
    it('evicts oldest entry when limit reached', () => {
      let calls = 0;
      const fn = memoizeWithLimit((x: unknown) => { calls++; return x; }, 2);

      fn(1);
      fn(2);
      fn(3); // evicts key for 1

      expect(fn.cache.size).toBe(2);

      fn(1); // should recompute since evicted
      expect(calls).toBe(4);
    });

    it('does not exceed maxSize', () => {
      const fn = memoizeWithLimit((x: unknown) => x, 3);
      fn(1);
      fn(2);
      fn(3);
      fn(4);
      expect(fn.cache.size).toBeLessThanOrEqual(3);
    });
  });

  // ===== MEMO MAP =====

  describe('MemoMap', () => {
    it('stores and retrieves values', () => {
      const map = new MemoMap<string>();
      map.set('key', 'value');
      expect(map.get('key')).toBe('value');
    });

    it('returns undefined for missing keys', () => {
      const map = new MemoMap();
      expect(map.get('missing')).toBeUndefined();
    });

    it('checks existence with has()', () => {
      const map = new MemoMap<string>();
      map.set('key', 'value');
      expect(map.has('key')).toBe(true);
      expect(map.has('missing')).toBe(false);
    });

    it('deletes entries', () => {
      const map = new MemoMap<string>();
      map.set('key', 'value');
      expect(map.delete('key')).toBe(true);
      expect(map.has('key')).toBe(false);
    });

    it('clears all entries', () => {
      const map = new MemoMap<string>();
      map.set('a', '1');
      map.set('b', '2');
      map.clear();
      expect(map.size).toBe(0);
    });

    it('reports correct size', () => {
      const map = new MemoMap<string>();
      map.set('a', '1');
      map.set('b', '2');
      expect(map.size).toBe(2);
    });

    it('returns keys, values, entries', () => {
      const map = new MemoMap<string>();
      map.set('a', '1');
      map.set('b', '2');

      expect(map.keys()).toEqual(['a', 'b']);
      expect(map.values()).toEqual(['1', '2']);
      expect(map.entries()).toEqual([['a', '1'], ['b', '2']]);
    });

    it('evicts expired entries on access', () => {
      vi.useFakeTimers();
      const map = new MemoMap<string>({ ttl: 100 });
      map.set('key', 'value');

      vi.advanceTimersByTime(150);

      expect(map.get('key')).toBeUndefined();
      expect(map.has('key')).toBe(false);

      vi.useRealTimers();
    });

    it('evicts expired entries on size check', () => {
      vi.useFakeTimers();
      const map = new MemoMap<string>({ ttl: 100 });
      map.set('a', '1');

      vi.advanceTimersByTime(150);

      expect(map.size).toBe(0);

      vi.useRealTimers();
    });

    it('respects maxSize', () => {
      const map = new MemoMap<string>({ maxSize: 2 });
      map.set('a', '1');
      map.set('b', '2');
      map.set('c', '3');

      expect(map.size).toBeLessThanOrEqual(2);
    });
  });

  // ===== ASYNC MEMOIZE =====

  describe('memoizeAsync', () => {
    it('caches async results', async () => {
      let calls = 0;
      const fn = memoizeAsync(async (x: unknown) => {
        calls++;
        return (x as number) * 2;
      });

      expect(await fn(2)).toBe(4);
      expect(await fn(2)).toBe(4);
      expect(calls).toBe(1);
    });

    it('deduplicates concurrent calls', async () => {
      let calls = 0;
      const fn = memoizeAsync(async (x: unknown) => {
        calls++;
        await new Promise(r => setTimeout(r, 50));
        return (x as number) * 2;
      });

      const [a, b] = await Promise.all([fn(2), fn(2)]);
      expect(a).toBe(4);
      expect(b).toBe(4);
      expect(calls).toBe(1);
    });

    it('exposes cache and pending', async () => {
      const fn = memoizeAsync(async (x: unknown) => x);
      await fn(1);
      expect(fn.cache.size).toBe(1);
    });

    it('respects TTL', async () => {
      vi.useFakeTimers();
      let calls = 0;
      const fn = memoizeAsync(async (x: unknown) => { calls++; return x; }, { ttl: 100 });

      await fn(1);
      expect(calls).toBe(1);

      vi.advanceTimersByTime(150);

      await fn(1);
      expect(calls).toBe(2);

      vi.useRealTimers();
    });
  });

  // ===== MEMOIZE WITH STATS =====

  describe('memoizeWithStats', () => {
    it('tracks hits and misses', () => {
      const fn = memoizeWithStats((x: unknown) => x);

      fn(1); // miss
      fn(1); // hit
      fn(2); // miss
      fn(1); // hit

      const stats = fn.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('reports zero hitRate with no calls', () => {
      const fn = memoizeWithStats((x: unknown) => x);
      expect(fn.stats().hitRate).toBe(0);
    });

    it('reports cache size in stats', () => {
      const fn = memoizeWithStats((x: unknown) => x);
      fn(1);
      fn(2);
      expect(fn.stats().size).toBe(2);
    });
  });

  // ===== WEAK MEMOIZE =====

  describe('weakMemoize', () => {
    it('caches by object reference', () => {
      let calls = 0;
      const fn = weakMemoize((obj: object) => { calls++; return Object.keys(obj).length; });

      const obj = { a: 1, b: 2 };
      expect(fn(obj)).toBe(2);
      expect(fn(obj)).toBe(2);
      expect(calls).toBe(1);
    });

    it('treats different objects as different keys', () => {
      let calls = 0;
      const fn = weakMemoize((obj: object) => { calls++; return Object.keys(obj).length; });

      fn({ a: 1 });
      fn({ a: 1 });
      expect(calls).toBe(2);
    });

    it('exposes WeakMap cache', () => {
      const fn = weakMemoize((obj: object) => obj);
      const obj = { a: 1 };
      fn(obj);
      // WeakMap doesn't have size, but cache should exist
      expect(fn.cache).toBeInstanceOf(WeakMap);
    });
  });

  // ===== DEBOUNCE MEMOIZE =====

  describe('memoizeDebounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('caches within debounce period', () => {
      let calls = 0;
      const fn = memoizeDebounce((x: unknown) => { calls++; return x; }, 1000);

      fn(1);
      fn(1);
      expect(calls).toBe(1);
    });

    it('recomputes after debounce period', () => {
      let calls = 0;
      const fn = memoizeDebounce((x: unknown) => { calls++; return x; }, 100);

      fn(1);
      expect(calls).toBe(1);

      vi.advanceTimersByTime(150);

      fn(1);
      expect(calls).toBe(2);
    });

    it('cancel clears everything', () => {
      const fn = memoizeDebounce((x: unknown) => x, 1000);
      fn(1);
      fn.cancel();
      expect(fn.cache.size).toBe(0);
    });
  });

  // ===== UTILITY FUNCTIONS =====

  describe('clearCache', () => {
    it('clears memoized function cache', () => {
      const fn = memoize((x: unknown) => x);
      fn(1);
      fn(2);
      expect(fn.cache.size).toBe(2);

      clearCache(fn);
      expect(fn.cache.size).toBe(0);
    });
  });

  describe('cacheSize', () => {
    it('returns cache size', () => {
      const fn = memoize((x: unknown) => x);
      expect(cacheSize(fn)).toBe(0);
      fn(1);
      fn(2);
      expect(cacheSize(fn)).toBe(2);
    });

    it('returns 0 for empty cache', () => {
      const fn = memoize((x: unknown) => x);
      expect(cacheSize(fn)).toBe(0);
    });
  });

  // ===== EDGE CASES =====

  describe('edge cases', () => {
    it('handles no-arg functions', () => {
      let calls = 0;
      const fn = memoize(() => { calls++; return 42; });
      expect(fn()).toBe(42);
      expect(fn()).toBe(42);
      expect(calls).toBe(1);
    });

    it('handles complex arguments', () => {
      let calls = 0;
      const fn = memoize((a: unknown, b: unknown) => { calls++; return [a, b]; });

      fn([1, 2], { x: 3 });
      fn([1, 2], { x: 3 });
      expect(calls).toBe(1);
    });

    it('handles functions returning undefined', () => {
      let calls = 0;
      const fn = memoize(() => { calls++; });
      fn();
      fn();
      expect(calls).toBe(1);
    });

    it('handles functions returning null', () => {
      let calls = 0;
      const fn = memoize(() => { calls++; return null; });
      expect(fn()).toBe(null);
      expect(fn()).toBe(null);
      expect(calls).toBe(1);
    });
  });
});
