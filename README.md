# ⚡ @chaisser/memoize

> **Function memoization with TTL, cache size limit, stats, async support, and more**

---

## ✨ Features

- 🎯 **Type-safe** - Full TypeScript support with generics
- ⏱️ **TTL support** - Cache entries with time-to-live expiration
- 📏 **Size limits** - LRU-style eviction when cache exceeds maxSize
- 📊 **Cache stats** - Track hits, misses, and hit rate
- 🔄 **Async support** - Deduplicate concurrent async calls
- 🗂️ **MemoMap class** - Explicit key/value cache with full control
- 🪶 **Weak memoize** - WeakMap-based caching for object arguments
- ⏳ **Debounce memoize** - Cache results for a debounce period
- 🔧 **Custom resolvers** - Control cache key generation
- 🪶 **Zero dependencies** - Lightweight and tree-shakeable
- 🏎️ **ESM + CJS** - Dual module format support

---

## 📦 Installation

```bash
npm install @chaisser/memoize
# or
yarn add @chaisser/memoize
# or
pnpm add @chaisser/memoize
```

---

## 🚀 Quick Start

```typescript
import {
  memoize,
  memoizeWithTTL,
  memoizeWithLimit,
  memoizeAsync,
  memoizeWithStats,
} from '@chaisser/memoize';

// Basic memoization
const double = memoize((x: number) => {
  console.log('computing...');
  return x * 2;
});
double(2); // computing... → 4
double(2); // → 4 (cached)

// With TTL (5 seconds)
const fetchUser = memoizeWithTTL((id: string) => {
  return db.findUser(id);
}, 5000);

// With cache limit (max 100 entries)
const compute = memoizeWithLimit((key: string) => {
  return expensiveCalculation(key);
}, 100);

// Async with deduplication
const fetchData = memoizeAsync(async (url: string) => {
  const res = await fetch(url);
  return res.json();
});
```

---

## 📖 What It Does

This package provides function memoization utilities for JavaScript and TypeScript. It supports TTL-based cache expiration, LRU-style size limits, async function deduplication, cache statistics tracking, explicit cache control via the `MemoMap` class, and WeakMap-based memoization — all with full TypeScript generics.

---

## 🎯 How It Works

The package provides:

- **Core** - `memoize`, `memoizeWithTTL`, `memoizeWithLimit`
- **Async** - `memoizeAsync` (deduplicates concurrent calls)
- **Stats** - `memoizeWithStats` (tracks hits/misses/hitRate)
- **Cache class** - `MemoMap` (explicit key/value cache with TTL and size limit)
- **Weak** - `weakMemoize` (WeakMap-based for object arguments)
- **Debounce** - `memoizeDebounce` (cache for a debounce period)
- **Utilities** - `clearCache`, `cacheSize`, `defaultResolver`

---

## 🎨 What It's Useful For

- **Expensive computations** - Cache results of costly calculations
- **API calls** - Deduplicate and cache HTTP responses
- **Database queries** - Avoid redundant lookups within a time window
- **React render optimization** - Memoize selectors and derived data
- **Rate limiting** - Prevent redundant work via debounce memoization
- **Performance monitoring** - Track cache hit rates with stats

---

## 💡 Usage Examples

### Basic Memoization

```typescript
import { memoize } from '@chaisser/memoize';

const factorial = memoize((n: number): number => {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
});

factorial(10); // computes
factorial(10); // cached
factorial(9);  // cached (was computed as part of factorial(10))
```

### With TTL

```typescript
import { memoizeWithTTL } from '@chaisser/memoize';

const getStockPrice = memoizeWithTTL((symbol: string) => {
  return fetchLatestPrice(symbol);
}, 30_000); // cache for 30 seconds
```

### With Cache Size Limit

```typescript
import { memoizeWithLimit } from '@chaisser/memoize';

const lookup = memoizeWithLimit((key: string) => {
  return expensiveLookup(key);
}, 50); // max 50 cached entries (LRU eviction)
```

### Full Options

```typescript
import { memoize } from '@chaisser/memoize';

const fn = memoize(
  (x: number, y: number) => x + y,
  {
    ttl: 10_000,     // expire after 10 seconds
    maxSize: 100,    // max 100 entries
    resolver: (x, y) => `${x},${y}`, // custom cache key
  }
);
```

### Async with Deduplication

```typescript
import { memoizeAsync } from '@chaisser/memoize';

const fetchUser = memoizeAsync(async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}, { ttl: 60_000 });

// Two concurrent calls with same id → only one fetch
const [user1, user2] = await Promise.all([
  fetchUser('123'),
  fetchUser('123'),
]);
```

### Cache Statistics

```typescript
import { memoizeWithStats } from '@chaisser/memoize';

const compute = memoizeWithStats((x: number) => x * 2);

compute(1); // miss
compute(1); // hit
compute(2); // miss

const stats = compute.stats();
// { hits: 1, misses: 2, hitRate: 0.333, size: 2 }
```

### MemoMap (Explicit Cache Control)

```typescript
import { MemoMap } from '@chaisser/memoize';

const cache = new MemoMap<{ data: string }>({ ttl: 5000, maxSize: 100 });

cache.set('user:1', { data: 'Alice' });
cache.get('user:1');     // { data: 'Alice' }
cache.has('user:1');     // true
cache.size;              // 1
cache.keys();            // ['user:1']
cache.values();          // [{ data: 'Alice' }]
cache.entries();         // [['user:1', { data: 'Alice' }]]
cache.delete('user:1');  // true
cache.clear();
```

### Weak Memoize

```typescript
import { weakMemoize } from '@chaisser/memoize';

const getMetadata = weakMemoize((obj: Record<string, unknown>) => {
  return Object.keys(obj);
});

const obj = { a: 1, b: 2 };
getMetadata(obj); // ['a', 'b'] — computed
getMetadata(obj); // ['a', 'b'] — cached by reference
```

### Debounce Memoize

```typescript
import { memoizeDebounce } from '@chaisser/memoize';

const search = memoizeDebounce((query: string) => {
  return performSearch(query);
}, 5000); // cache results for 5 seconds

search('hello'); // computed
search('hello'); // cached
// after 5 seconds, cache expires
```

### Cache Utilities

```typescript
import { memoize, clearCache, cacheSize } from '@chaisser/memoize';

const fn = memoize((x: number) => x * 2);
fn(1);
fn(2);

cacheSize(fn);  // 2
clearCache(fn);
cacheSize(fn);  // 0
```

---

## 📚 API Reference

### Core Memoization

| Function | Signature | Description |
|---|---|---|
| `memoize(fn, options?)` | `(Fn, MemoOptions?) → Fn & { cache }` | Memoize with optional TTL, maxSize, resolver |
| `memoizeWithTTL(fn, ttl, resolver?)` | `(Fn, number, Resolver?) → Fn & { cache }` | Shorthand for TTL-only memoization |
| `memoizeWithLimit(fn, maxSize, resolver?)` | `(Fn, number, Resolver?) → Fn & { cache }` | Shorthand for size-limited memoization |

### MemoOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `ttl` | `number` | `Infinity` | Time-to-live in milliseconds |
| `maxSize` | `number` | `Infinity` | Maximum cache entries (LRU eviction) |
| `resolver` | `(...args) => string` | `defaultResolver` | Custom cache key function |

### Async

| Function | Description |
|---|---|
| `memoizeAsync(fn, options?)` | Memoize async functions, deduplicates concurrent calls |

### Stats

| Function | Description |
|---|---|
| `memoizeWithStats(fn, options?)` | Memoize with hit/miss tracking via `.stats()` |

Returns `{ hits, misses, hitRate, size }` from `.stats()`.

### MemoMap

```typescript
const cache = new MemoMap<T>({ ttl?, maxSize? });
cache.get(key);       // T | undefined
cache.set(key, value); // void
cache.has(key);        // boolean
cache.delete(key);     // boolean
cache.clear();         // void
cache.size;            // number
cache.keys();          // string[]
cache.values();        // T[]
cache.entries();       // [string, T][]
```

### Specialized

| Function | Description |
|---|---|
| `weakMemoize(fn)` | WeakMap-based cache for object arguments |
| `memoizeDebounce(fn, delay, resolver?)` | Cache results for a debounce period |

### Utilities

| Function | Description |
|---|---|
| `clearCache(fn)` | Clear a memoized function's cache |
| `cacheSize(fn)` | Get the cache size of a memoized function |
| `defaultResolver(...args)` | Default cache key serializer |

---

## 🔗 Related Packages

Explore our other utility packages in the @chaisser namespace:

- **@chaisser/memoize** (this package) - Function memoization with TTL and cache size limit
- [@chaisser/chunk-array](https://www.npmjs.com/package/@chaisser/chunk-array) - Split arrays into chunks
- [@chaisser/string-wizard](https://www.npmjs.com/package/@chaisser/string-wizard) - Advanced string manipulation
- [@chaisser/type-guard](https://www.npmjs.com/package/@chaisser/type-guard) - Runtime type guards and validators
- [@chaisser/uuid-v7](https://www.npmjs.com/package/@chaisser/uuid-v7) - Time-ordered UUID v7 generator
- [@chaisser/wait-for](https://www.npmjs.com/package/@chaisser/wait-for) - Promise-based wait utilities
- [@chaisser/regex-humanizer](https://www.npmjs.com/package/@chaisser/regex-humanizer) - Regex to human-readable descriptions
- [@chaisser/password-strength](https://www.npmjs.com/package/@chaisser/password-strength) - Password strength checker
- [@chaisser/human-time](https://www.npmjs.com/package/@chaisser/human-time) - Human-readable time formatting
- [@chaisser/obj-path](https://www.npmjs.com/package/@chaisser/obj-path) - Safe dot-notation object access
- [@chaisser/debounce-throttle](https://www.npmjs.com/package/@chaisser/debounce-throttle) - Rate limiting utilities
- [@chaisser/color-utils](https://www.npmjs.com/package/@chaisser/color-utils) - Color conversion utilities
- [@chaisser/deep-clone](https://www.npmjs.com/package/@chaisser/deep-clone) - Deep cloning functions
- [@chaisser/array-group-by](https://www.npmjs.com/package/@chaisser/array-group-by) - Array grouping utilities
- [@chaisser/merge-objects](https://www.npmjs.com/package/@chaisser/merge-objects) - Object merge utilities
- [@chaisser/event-emitter](https://www.npmjs.com/package/@chaisser/event-emitter) - Typed event emitter
- [@chaisser/unique-by](https://www.npmjs.com/package/@chaisser/unique-by) - Array uniqueness utilities

---

## 🔒 License

**MIT** - Free to use in personal and commercial projects

---

## 👨 Developed by

**Doruk Karaboncuk** <doruk.karaboncuk@interaktifis.com>

---

## 📄 Repository

- **GitHub:** [@Chaisser](https://github.com/Chaisser)
- **NPM:** [@chaisser/memoize](https://www.npmjs.com/package/@chaisser/memoize)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

---

## 📞 Support

For issues, questions, or suggestions, please reach out through:
- **Email:** doruk.karaboncuk@interaktifis.com
- **GitHub Issues:** [Create an issue](https://github.com/Chaisser/memoize/issues)

---

<div align="center">

Made with ❤️ by [@chaisser](https://www.npmjs.com/~chaisser)

</div>
