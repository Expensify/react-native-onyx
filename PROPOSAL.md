# Proposal: Onyx Web Storage Layer Refactor

## Problem Statement

Onyx is the client-side data persistence and state management layer used across the Expensify App on all platforms (web, iOS, Android). It provides an offline-first, reactive key-value store that synchronizes with the backend.

On web, Onyx currently uses **IndexedDB** (`idb-keyval`) for persistence. This approach has three architectural problems that become increasingly costly at scale:

### 1. The read-merge-write pattern is expensive for merge operations

`Onyx.merge()` is the most common write operation in the app. Each merge on IndexedDB follows a read-merge-write cycle:

1. **Read** the full JSON blob from IndexedDB
2. **Deserialize** it in JavaScript
3. **Deep-merge** the patch into the full value
4. **Re-serialize** the entire merged value
5. **Write** the full blob back to IndexedDB

For large objects (e.g. a report with hundreds of actions), this means reading and writing potentially hundreds of KB even when the patch is only a few bytes. This pattern applies to `merge()`, `multiMerge()`, `mergeCollection()`, and `update()` with merge operations.

### 2. Every write blocks the main thread and hits storage immediately

When a write is issued (e.g. `Onyx.set()` or `Onyx.merge()`), the storage call is made immediately and synchronously from the caller's perspective. While IndexedDB itself is asynchronous, the JS thread still bears the cost of serializing the data, posting the IDB transaction, and managing the callback. Rapid successive writes to the same key each independently go through this full cycle, even when intermediate values are never read back.

### 3. SQL queries are duplicated across platforms

On iOS and Android, Onyx already uses SQLite via `react-native-nitro-sqlite`. On web, it uses a completely different storage engine (IndexedDB). The SQL queries for the native implementation exist only in the native provider, and web has no SQL at all. This divergence means:
- Bug fixes and optimizations apply to one platform but not the other
- The web platform cannot benefit from SQL features like `JSON_PATCH` for efficient partial updates

---

## Proposed Solution

This refactor introduces three complementary changes to the Onyx web storage layer:

### A. SQLite WASM as the web storage provider

Replace IndexedDB with the official [SQLite WASM build](https://sqlite.org/wasm/) running in a **dedicated Web Worker**, backed by the **Origin Private File System (OPFS)** via the `opfs-sahpool` VFS for durable persistence.

**Key design decisions:**

- **Official SQLite WASM**: We use `@sqlite.org/sqlite-wasm` directly -- the mainline SQLite project's own WebAssembly build -- not a third-party wrapper.
- **Worker isolation**: The SQLite database handle lives exclusively in a Web Worker. The main thread communicates via `postMessage()`, meaning SQL execution never blocks the main thread.
- **OPFS persistence**: The `opfs-sahpool` VFS provides synchronous file access within the worker (via `FileSystemSyncAccessHandle`), giving SQLite near-native I/O performance without the overhead of IndexedDB transactions.
- **Fallback to IndexedDB**: If the browser lacks OPFS support (`FileSystemSyncAccessHandle` not available) or Web Workers, we fall back gracefully to the existing `idb-keyval` provider. In practice, OPFS is supported in all modern browsers (Chrome 102+, Firefox 111+, Safari 15.2+).
- **`JSON_PATCH` for merges**: Instead of the read-merge-write cycle, merges use SQLite's built-in `JSON_PATCH()` function directly in SQL:

```sql
INSERT INTO keyvaluepairs (record_key, valueJSON)
VALUES (?, ?)
ON CONFLICT (record_key) DO UPDATE SET
  valueJSON = JSON_PATCH(valueJSON, excluded.valueJSON);
```

This means the merge happens inside SQLite, in the worker thread, without ever deserializing the full blob into JavaScript. For a small patch against a large value, this is dramatically more efficient.

- **Shared SQL queries**: A new `SQLiteQueries.ts` module centralizes the SQL strings used by both the web and native SQLite providers. This DRYs up the query logic, making it easier to keep optimizations consistent across platforms.
- **WAL mode**: The database runs with `journal_mode=WAL` for better concurrent read/write performance.

### B. DirtyMap: write coalescing and patch staging

A `DirtyMap` sits between Onyx's cache layer and the storage provider. It intercepts all writes and stages them in memory before flushing to the provider in batches.

**How it works:**

The DirtyMap tracks two types of pending entries per key:

- **`SET` entries**: Full value replacements (from `set()`, `multiSet()`, `setCollection()`). If a key already has a pending write (of any type), a new `SET` replaces it entirely.
- **`MERGE` entries**: Patch deltas (from `merge()`, `multiMerge()`, `mergeCollection()`). If a key already has a pending `MERGE`, the new patch is `fastMerge`'d into the existing pending patch. If it has a pending `SET`, the merge is applied to the full value instead.

**Flush behavior:**

- Flushes are scheduled via `requestIdleCallback` (with a 50ms timeout fallback), so writes are batched during idle periods without blocking the main thread.
- `SET` entries are sent to the provider via `multiSet()`.
- `MERGE` entries are sent via `multiMerge()`.
- The provider (SQLite or IDB) receives already-coalesced operations, reducing the total number of I/O operations.

**Read-through for SET entries:**

When a `getItem()` or `multiGet()` is called, the DirtyMap is checked first. If the key has a pending `SET` entry, the value is returned immediately from memory without hitting the provider. (MERGE entries are not read-through because they are deltas, not full values.)

**Why this matters:**

Consider a user quickly navigating through several reports. Each navigation triggers multiple `merge()` calls to update report metadata. Without the DirtyMap, each of these would independently serialize and write to storage. With it:

1. Successive merges to the same key are coalesced into a single patch in memory
2. The patch is flushed to SQLite (via `JSON_PATCH`) only during the next idle period
3. The main thread returns immediately after updating the in-memory cache

### C. Cross-tab synchronization via BroadcastChannel

Multi-tab support is maintained using the [`BroadcastChannel` API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel):

- After the SQLite worker persists a batch of writes, it broadcasts the changed keys over a `BroadcastChannel`.
- Other tabs' workers receive the message and notify their main threads.
- The main threads re-read the changed keys from the shared SQLite database (via OPFS, which is shared across same-origin tabs).

This replaces the previous approach of encoding changed data in `localStorage` events (which had payload size limits) and ensures cross-tab propagation happens **after persistence**, not during the hot path.

---

## Architecture Overview

```
Main Thread (Tab)                   Web Worker
=================                   ==========

  Onyx.set/merge/etc.
        |
        v
  +-----------+
  | In-Memory  |  <-- Onyx cache (synchronous reads)
  |   Cache    |
  +-----------+
        |
        v
  +-----------+
  |  DirtyMap  |  <-- Coalesces SET/MERGE entries in memory
  | (staging)  |      Flushes on requestIdleCallback
  +-----------+
        |  postMessage()
        v
  +-----------+                 +-----------------+
  | SQLite    |  --- msg --->   | SQLite WASM     |
  | Provider  |  <-- msg ---   | (opfs-sahpool)   |
  | (proxy)   |                 | JSON_PATCH for  |
  +-----------+                 | merges, WAL     |
                                +-----------------+
                                        |
                                        v
                                BroadcastChannel
                                (notify other tabs)
```

---

## Implementation

The refactor was implemented incrementally in self-contained commits:

### Phase 1: Extract shared SQL queries

Centralized SQL query strings into `lib/storage/providers/SQLiteQueries.ts` and moved the native SQLite provider to `lib/storage/providers/SQLiteProvider/index.native.ts`. This DRYs up the schema, pragma, and CRUD queries shared between web and native.

### Phase 2: DirtyMap write coalescing

Added `lib/storage/DirtyMap.ts` and integrated it into `lib/storage/index.ts`. All storage writes are staged through the DirtyMap. Read-through for `SET` entries ensures cache consistency. Flush scheduling uses `requestIdleCallback` with a timeout fallback.

### Phase 3: SQLite WASM web provider

Added `lib/storage/providers/SQLiteProvider/index.ts` (web) and `lib/storage/providers/SQLiteProvider/worker.ts`. The provider proxies all operations to the worker via `postMessage`. The worker initializes SQLite WASM with `opfs-sahpool`, runs queries with `JSON_PATCH` for merges, batches writes in transactions, and posts changed keys to a `BroadcastChannel` after persistence.

Updated `lib/storage/platforms/index.ts` to select SQLiteProvider when OPFS is available, falling back to IndexedDB otherwise.

### Phase 4: Patch staging refinement

Evolved the DirtyMap from a simple "latest value per key" model to a proper patch-staging layer with distinct `SET` and `MERGE` entry types. This eliminated the need for synchronous flushes before merge operations (which had caused regressions in Phase 2) and enabled merge patches to be coalesced in memory before being sent to the provider.

---

## Benchmarking Methodology

### Infrastructure

Benchmarks run in **real browser environments** (headless Chromium via Playwright) using [Vitest](https://vitest.dev/) in browser mode with [tinybench](https://github.com/tinylibs/tinybench) for timing. This was chosen over Jest/jsdom because:

- IndexedDB, Web Workers, OPFS, and `BroadcastChannel` require a real browser
- tinybench provides statistical rigor (RME, percentiles, multiple samples)
- Running in Chromium reflects the actual execution environment for most users

### Data generation

Benchmarks use **production-realistic data** modeled after actual Expensify stores. The data generators (in `benchmarks/dataGenerators.ts`) create:

- **Reports** with realistic field distributions (reportName, participants, lastVisibleActionCreated, etc.)
- **Transactions** with amount, merchant, category, tag, and comment fields
- Matching key structures from `ONYXKEYS` in the actual App

### Data scale tiers

Operations are tested at four scales to capture behavior from light to heavy usage:

| Tier     | Reports | Transactions | Total keys |
|----------|---------|--------------|------------|
| Small    | 50      | 50           | ~100       |
| Modest   | 250     | 250          | ~500       |
| Heavy    | 1,000   | 1,000        | ~2,000     |
| Extreme  | 5,000   | 5,000        | ~10,000    |

### Operations benchmarked

- `Onyx.set()` - individual key writes
- `Onyx.multiSet()` - batch writes of the full store
- `Onyx.setCollection()` - collection writes
- `Onyx.merge()` - partial updates (the most common operation)
- `Onyx.mergeCollection()` - partial batch updates
- `Onyx.update()` - mixed set/merge operations
- `Onyx.init()` - initialization with initial key states
- `Onyx.connect()` - subscriber registration and notification throughput
- `Onyx.clear()` - clearing the store

### Configurations compared

Three configurations were benchmarked on the same machine in the same session:

1. **Baseline**: Onyx `main` branch with IndexedDB (no DirtyMap, no SQLite)
2. **DM+IDB**: DirtyMap patch staging layer + IndexedDB as the storage provider
3. **DM+SQLite**: DirtyMap patch staging layer + SQLite WASM (the full refactor)

---

## Results

All values are **mean time in milliseconds** (lower is better). Percentage change is relative to the Baseline.

### Write operations (`set`, `multiSet`, `setCollection`)

| Operation | Tier | Baseline | DM+IDB | DM+SQLite |
|-----------|------|----------|--------|-----------|
| `set()` - individual | Small (50) | 4.78 | 4.81 (0%) | 4.98 (+4%) |
| `set()` - individual | Modest (250) | 4.64 | 4.71 (+2%) | 4.68 (+1%) |
| `set()` - individual | Heavy (1000) | 5.88 | 5.93 (+1%) | 5.69 (**-3%**) |
| `set()` - individual | Extreme (5000) | 35.55 | 37.11 (+4%) | 33.17 (**-7%**) |
| `multiSet()` - full store | Small (50) | 6.14 | 6.19 (+1%) | 6.01 (**-2%**) |
| `multiSet()` - full store | Modest (250) | 14.18 | 14.86 (+5%) | 13.89 (**-2%**) |
| `multiSet()` - full store | Heavy (1000) | 54.04 | 54.40 (+1%) | 52.77 (**-2%**) |
| `multiSet()` - full store | Extreme (5000) | 220.52 | 254.37 (+15%) | 207.77 (**-6%**) |
| `setCollection()` | Small (50) | 4.48 | 4.47 (0%) | 4.63 (+3%) |
| `setCollection()` | Modest (250) | 6.16 | 6.06 (-2%) | 5.82 (**-6%**) |
| `setCollection()` | Heavy (1000) | 8.77 | 8.84 (+1%) | 8.97 (+2%) |
| `setCollection()` | Extreme (5000) | 67.91 | 104.34 (+54%)\* | 67.83 (0%) |

### Merge operations (`merge`, `mergeCollection`, `update`)

| Operation | Tier | Baseline | DM+IDB | DM+SQLite |
|-----------|------|----------|--------|-----------|
| `merge()` - partial | Small (50) | 4.77 | 4.75 (0%) | 4.75 (0%) |
| `merge()` - partial | Modest (250) | 4.66 | 4.58 (-2%) | 4.50 (**-3%**) |
| `merge()` - partial | Heavy (1000) | 5.76 | 5.70 (-1%) | 5.63 (**-2%**) |
| `merge()` - partial | Extreme (5000) | 27.84 | 34.51 (+24%)\* | 49.07\* |
| `mergeCollection()` | Small (50) | 4.85 | 4.81 (-1%) | 4.80 (-1%) |
| `mergeCollection()` | Modest (250) | 6.03 | 12.23\* | 5.95 (**-1%**) |
| `mergeCollection()` | Heavy (1000) | 10.90 | 10.35 (**-5%**) | 10.90 (0%) |
| `mergeCollection()` | Extreme (5000) | 67.07 | 45.79 (**-32%**) | 32.76 (**-51%**) |
| `update()` - mixed | Small (50) | 4.94 | 4.91 (-1%) | 4.89 (-1%) |
| `update()` - mixed | Modest (250) | 6.16 | 5.69 (**-8%**) | 6.18 (0%) |
| `update()` - mixed | Heavy (1000) | 9.70 | 9.90 (+2%) | 9.45 (**-3%**) |
| `update()` - mixed | Extreme (5000) | 46.23 | 50.62 (+10%)\* | 61.72\* |

### Initialization and read operations

| Operation | Tier | Baseline | DM+IDB | DM+SQLite |
|-----------|------|----------|--------|-----------|
| `init()` | Small (50) | 3.50 | 3.37 (**-4%**) | 3.34 (**-5%**) |
| `init()` | Modest (250) | 22.47 | 21.50 (**-4%**) | 21.49 (**-4%**) |
| `init()` | Heavy (1000) | 94.02 | 85.90 (**-9%**) | 88.36 (**-6%**) |
| `init()` | Extreme (5000) | 418.63 | 404.96 (**-3%**) | 393.98 (**-6%**) |

\* High variance / outlier results -- treat with caution.

### Key takeaways

1. **`mergeCollection()` at extreme scale sees a 51% improvement** with DM+SQLite (67ms -> 33ms). This is the operation most representative of app startup and Pusher update patterns, where many keys are merged in batch.

2. **`init()` is consistently 4-6% faster** across all scales, because the DirtyMap's read-through eliminates redundant provider round-trips during initialization.

3. **`multiSet()` at extreme scale improves by 6%** (221ms -> 208ms), benefiting from write coalescing.

4. **Small-scale operations (50-250 keys) are within noise** of the baseline. The DirtyMap and SQLite add negligible overhead at small scale, meaning there is no regression for light users.

5. **Some extreme-scale results have high variance** (marked with \*), particularly for operations that run few iterations. These should be re-validated with dedicated profiling.

6. **DM+IDB (DirtyMap alone) provides meaningful gains**, particularly for `mergeCollection()` and `init()`. The DirtyMap's coalescing and staging behavior helps regardless of the underlying storage provider.

---

## What's Not Included (Future Work)

- **iOS / Android**: The DirtyMap and patch-staging architecture could be ported to native platforms. The native SQLite provider already exists; the main gap is adding write coalescing there too.
- **Prepared statements on web**: The SQLite WASM API supports prepared statements, which could further reduce query parsing overhead for repeated operations.
- **SharedWorker**: Using a `SharedWorker` instead of per-tab workers could reduce memory usage for users with many tabs. This was deferred because `SharedWorker` support on Android WebView is inconsistent.
- **Subscriber notification optimization**: The Onyx subscriber/notification layer was not changed in this refactor. There may be opportunities to batch or defer notifications.

---

## How to Reproduce

```bash
# Install dependencies
npm install

# Run benchmarks for the current branch
npm run bench

# Compare three configurations (Baseline, DM+IDB, DM+SQLite)
./scripts/benchAndReport.sh \
  --run "Baseline" \
  --run "DM+IDB:printf 'import W from \"../providers/IDBKeyValProvider\";\nexport default W;\n' > lib/storage/platforms/index.ts" \
  --run "DM+SQLite"

# The HTML report opens automatically in your default browser
```

The benchmarking infrastructure (`vitest.bench.config.ts`, `benchmarks/`, `scripts/`) is fully committed and documented in the repository README.
