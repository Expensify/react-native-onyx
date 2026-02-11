/**
 * Native (iOS/Android) storage platform selection.
 *
 * Uses the native SQLite provider (react-native-nitro-sqlite) with persistence
 * managed by the NativeFlushWorker. The WriteBuffer populates a HybridObject-
 * backed BufferStore (shared memory), and the NativeFlushWorker periodically
 * drains it and persists to SQLite.
 *
 * Read operations go directly to the SQLite provider (bypassing the buffer).
 * The WriteBuffer's read-through handles in-flight writes.
 *
 * NOTE: The NativeFlushWorker currently uses setInterval as a transitional
 * implementation. Once react-native-worklets integration is complete, the
 * flush logic will run on a true Worklet Worker Runtime background thread.
 */
import createNativeFlushWorker from '../NativeFlushWorker';
import createNativeBufferStore from '../BufferStore/index.native';
import type StorageProvider from '../providers/types';

// Create the shared buffer (HybridObject or JS Map fallback)
const bufferStore = createNativeBufferStore();

// Create and start the flush worker
const flushWorker = createNativeFlushWorker(bufferStore);
flushWorker.start();

// The native provider is accessed via the flush worker for read operations
const nativeProvider = flushWorker.getProvider();

/**
 * Native storage provider that delegates reads to the SQLite provider
 * and uses the WriteBuffer + NativeFlushWorker for writes.
 */
const NativeStorage: StorageProvider<unknown> = {
    store: nativeProvider.store,
    name: nativeProvider.name,

    init() {
        // Already initialized by flushWorker.start()
    },

    getItem: (key) => nativeProvider.getItem(key),
    multiGet: (keys) => nativeProvider.multiGet(keys),
    setItem: (key, value) => nativeProvider.setItem(key, value),
    multiSet: (pairs) => nativeProvider.multiSet(pairs),
    multiMerge: (pairs) => nativeProvider.multiMerge(pairs),
    mergeItem: (key, change, replaceNullPatches) => nativeProvider.mergeItem(key, change, replaceNullPatches),
    getAllKeys: () => nativeProvider.getAllKeys(),
    removeItem: (key) => nativeProvider.removeItem(key),
    removeItems: (keys) => nativeProvider.removeItems(keys),
    clear: () => nativeProvider.clear(),
    getDatabaseSize: () => nativeProvider.getDatabaseSize(),
};

export default NativeStorage;
export {bufferStore, flushWorker};
