*Proposal:* Make react-native-onyx up to 99% faster.

*Background:*
*_Onyx who?_*
react-native-onyx is the backbone and beating heart of New Expensify. It drives both most of our state management and data persistence in the front-end. Onyx consists of three main layers:

* *The In-Memory Cache.* Most of the data in Onyx is kept hot in an in-memory cache. Onyx operations such as `set`, `merge`, `mergeCollection`, or their combined for `update` synchronously update the cache and notify subscribers immediately. These functions also kick off an synchronous call to the persistence layer.
* *The Persistence Layer.* This layer is responsible for saving data to disk so it is stored offline and can be retrieved later.
    * On web, it uses IndexedDB
    * On iOS/Android, it uses react-native-nitro-sqlite.
* *The Subscription Layer.* This layer is responsible for tracking subscribers and propagating state changes across tabs and across the React tree.

*_Onyx is single-threaded_*
JavaScript is generally single-threaded, so all of this happens in a single thread. This means that each time `Onyx.update` is called, we:

* Update the cache
* Notify subscribers
* Persist the change to disk

To be clear, this doesn't happen synchronously with every call to `Onyx.update`. We have some batching mechanisms (for `Onyx.merge` only), and we notify subscribers optimistically from the cache before asynchronously persisting the change to disk. But it does all happen in a single thread - the same thread that also handles all React rendering and nearly all the rest of the app logic. This fundamentally means that CPU cycles spent on persistence can't be used for other work like React rendering.

*_How Onyx merge works_*
Furthermore, `Onyx.merge()` is the most common write operation in the app. Each merge on IndexedDB follows a read-merge-write cycle:

1. *Read* the full JSON blob from IndexedDB
2. *Deserialize* it in JavaScripht
3. *Deep-merge* the patch into the full value
4. *Re-serialize* the entire merged value
5. *Write* the full blob back to IndexedDB

For large objects (e.g. a report with hundreds of actions), this means reading and writing potentially hundreds of KB even when the patch is only a few bytes. This pattern applies to `merge()`, `multiMerge()`, `mergeCollection()`, and `update()` with merge operations.

*_How Onyx keeps multiple tabs in sync_*

Onyx's existing `InstanceSync` module (`lib/storage/InstanceSync/index.web.ts`) keeps multiple browser tabs in sync using the [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) on `localStorage`:

1. When any storage write occurs (set, merge, remove, clear), the storage layer calls `InstanceSync.setItem(key)` (or the multi-key equivalent).
2. `InstanceSync` writes the changed key name to `localStorage` under a sentinel key (`SYNC_ONYX`), then immediately removes it. This `set` + `remove` cycle fires a `storage` event in other tabs (the `storage` event only fires in tabs *other* than the one that triggered it).
3. In each receiving tab, the `storage` event listener reads the key name from `event.newValue`, then calls `storage.getItem(key)` to fetch the updated value from IndexedDB.
4. The fetched value is passed to Onyx's `onStorageKeyChanged` callback, which updates the in-memory cache and notifies subscribers.

This approach has several limitations:
- *One key per event*: Each `localStorage.setItem` fires a separate event, so a `multiSet` of N keys fires N events in every other tab, each triggering an IndexedDB read.
- *`localStorage` overhead*: The sentinel key is written to disk on every single storage operation, even though it is immediately removed.
- **No payload**: The `storage` event only carries the key name, not the value. Every receiving tab must independently re-read the full value from IndexedDB.

*_Multithreading on the web_*
On the web platform, JS provides the [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) to perform tasks on background threads, rather than in the main thread. These APIs are mature but have some limitations. In particular, using [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), the web API that allows memory to be directly shared between threads without copying, requires that your web app be [cross-origin isolated](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements), which almost certainly isn't feasible for Expensify in the near term. Our front-end interacts with multiple 3rd party origins, such as Plaid, Onfido, FullStory, and Sentry, and each of those origins would need to set the COOP/COEP headers and be cross-origin isolated as well.

So practically the only way to share data between threads in JavaScript in New Expensify today is with `postMessage` - you send data from one thread and listen on the other with an `onmessage` event handler. You can pass most serializable data you want across (no functions, but most other types are fair game). That data gets passed via a structured clone, which has some overhead, but less overhead than serialization+deserialization. This data passing can be problematic if you aren't careful, because that structured cloning can be slower than just doing everything in the main thread.

_Fun fact: https://github.com/tc39/proposal-structs exists specifically to address this shortcoming on the web platform. Alas, we shouldn't hold our breath..._

*_Multithreading on iOS/Android_*
On iOS/Android, the story is different. React Native is [architectured to run on two threads](https://reactnative.dev/architecture/threading-model), the JS thread where React runs and the main thread where the native C++/Swift/Kotlin code runs. They communicate with each other with low overhead using [Meta's JavaScriptInterface (JSI)](https://github.com/facebook/react-native/blob/main/packages/react-native/ReactCommon/jsi/jsi/jsi.h).

There are multiple module systems in the React Native ecosystem, but I'll be focusing on [NitroModules](https://nitro.margelo.com/), because it's the most performant, and in my opinion the easiest to understand in this context. The key building block is the [HybridObject](https://nitro.margelo.com/docs/hybrid-objects) - you define an object schema in TypeScript, and then [nitrogen](https://nitro.margelo.com/docs/nitrogen) generates rich C++ stucts for your schema at compile time. At runtime, you call `NitroModules.createHybridObject<MyType>()` and you get a JS object with the TypeScript type you specify, but with the memory for that object automagically shared between JS and a native thread. The JS HybridObject can (synchronously or asynchronously) interact with the native thread with very low overhead.

Thanks to JSI and NitroModules, it becomes possible to interact with native C++ APIs like `std::mutex` to synchronize work across threads without the overhead of structured cloning or message passing.

*Problem:* When expensive and/or inefficient storage operations happen on the main thread, if a user has high traffic or data volume, then the main thread gets jammed up persisting data, which slows down rendering, interactions, and just about everything else, which in turn prevents users from experiencing the app as snappy and responsive.

*Solution:*

1. Move the Onyx persistence layer to a worker thread.
    - Raw JS objects are passed from the main JS thread to the worker thread via `postMessage`. The worker thread handles serialization and persistence.
    - A web worker wraps the storage layer, handling `onmessage` events, and keeping the persistence layer it storage-provider-agnostic.
2. Update the main thread to use a `WriteBuffer` that sits between the cache layer and the persistence layer. The `WriteBuffer` will:
    - Track two types of pending entries per key:
        - *`SET` entries*: Full value replacements (from `set()`, `multiSet()`, `setCollection()`). If a key already has a pending write (of any type), a new `SET` replaces it entirely.
        - *`MERGE` entries*: Patch deltas (from `merge()`, `multiMerge()`, `mergeCollection()`). If a key already has a pending `MERGE`, the new patch is `fastMerge`'d into the existing pending patch. If it has a pending `SET`, the merge is applied to the full value instead.
    - Periodically flush writes to the persistence layer (now running in another thread) using `requestIdleCallback` (with a 200ms timeout fallback). i.e: "persist data when idle, or at most every 200ms".
    - The storage provider receives already-coalesced operations, reducing the total number of I/O operations
    - In the (rare) even that there's a cache miss in the cache layer and Onyx needs to read data from disk, the WriteBuffer is checked first:
        - *If there's a pending `SET` entry*: The full value is returned immediately from memory without hitting the provider.
        - *If there's a pending `MERGE` entry*: The WriteBuffer is flushed first, ensuring the provider has the correct merged value on disk, then the read proceeds normally.
        - *If there's no pending entry*: The read goes straight to the provider.
        - _Note:_  In practice this path is rarely (never?) hit because Onyx's in-memory cache (which sits above the WriteBuffer) handles most reads without reaching the storage layer. It's unclear in what scenario data could be missing from the cache _and_ have a pending write, but it's probably best to plug this correctness gap/potential race condition from the get-go.
3. Update the storage provider on web from IndexedDB to SQLite.
    - This allows us to leverage SQLite's built-in `JSON_PATCH` utilities to merge data, avoiding the `read` -> `deserialize` -> `merge` -> `serialize` -> `write` paradigm we have with `IndexedDB`.
    - We use the official SQLite WebAssembly (wasm) build directly, no 3rd-party wrapper needed.
    - For SQLite to work on the web, it must run in a worker thread. Fortunately, this proposal does just that.
4. Implement cross-tab synchronization via the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
    - 