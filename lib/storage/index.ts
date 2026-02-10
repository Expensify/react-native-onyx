import * as Logger from '../Logger';

import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import type StorageProvider from './providers/types';
import * as GlobalSettings from '../GlobalSettings';
import decorateWithMetrics from '../metrics';
import WriteBuffer from './WriteBuffer';

let provider = PlatformStorage as StorageProvider<unknown>;
let finishInitalization: (value?: unknown) => void;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});

type Storage = {
    getStorageProvider: () => StorageProvider<unknown>;
} & Omit<StorageProvider<unknown>, 'name' | 'store'>;

/**
 * Degrade performance by removing the storage provider and only using cache
 */
function degradePerformance(error: Error) {
    Logger.logHmmm(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.\n Error: ${error.message}\n Stack: ${error.stack}\n Cause: ${error.cause}`);
    console.error(error);
    provider = MemoryOnlyProvider;
}

/**
 * Runs a piece of code and degrades performance if certain errors are thrown
 */
function tryOrDegradePerformance<T>(fn: () => Promise<T> | T, waitForInitialization = true): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const promise = waitForInitialization ? initPromise : Promise.resolve();

        promise.then(() => {
            try {
                resolve(fn());
            } catch (error) {
                // Test for known critical errors that the storage provider throws, e.g. when storage is full
                if (error instanceof Error) {
                    // IndexedDB error when storage is full (https://github.com/Expensify/App/issues/29403)
                    if (error.message.includes('Internal error opening backing store for indexedDB.open')) {
                        degradePerformance(error);
                    }

                    // catch the error if DB connection can not be established/DB can not be created
                    if (error.message.includes('IDBKeyVal store could not be created')) {
                        degradePerformance(error);
                    }
                }

                reject(error);
            }
        });
    });
}

/**
 * The WriteBuffer is a patch-staging layer between Onyx's cache and the storage
 * provider. It tracks two types of pending entries:
 * - SET entries (full values) flushed via provider.multiSet()
 * - MERGE entries (accumulated patches) flushed via provider.multiMerge(),
 *   preserving JSON_PATCH efficiency on SQLite
 *
 * All writes (set, merge) return immediately after staging in the WriteBuffer.
 * Persistence happens asynchronously in coalesced batches.
 */
const writeBuffer = new WriteBuffer({
    multiSet: (pairs) => provider.multiSet(pairs),
    multiMerge: (pairs) => provider.multiMerge(pairs),
});

const storage: Storage = {
    /**
     * Returns the storage provider currently in use
     */
    getStorageProvider() {
        return provider;
    },

    /**
     * Initializes all providers in the list of storage providers
     * and enables fallback providers if necessary
     */
    init() {
        tryOrDegradePerformance(provider.init, false).finally(() => {
            finishInitalization();
        });
    },

    /**
     * Get the value of a given key or return `null` if it's not available.
     *
     * - If the key has a pending SET entry, it is returned directly from memory.
     * - If the key has a pending MERGE entry (a patch delta, not a full value),
     *   the write buffer is flushed first so the provider has the correct merged
     *   value on disk, then the read proceeds normally.
     * - Otherwise, the read goes straight to the provider.
     */
    getItem: (key) =>
        tryOrDegradePerformance(() => {
            if (writeBuffer.has(key)) {
                return Promise.resolve(writeBuffer.get(key));
            }
            if (writeBuffer.hasAny(key)) {
                return writeBuffer.flushNow().then(() => provider.getItem(key));
            }
            return provider.getItem(key);
        }),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     *
     * Keys with pending SET entries are served from memory. If any remaining
     * keys have pending MERGE entries, the write buffer is flushed before
     * reading from the provider so the on-disk values are up to date.
     */
    multiGet: (keys) =>
        tryOrDegradePerformance(() => {
            const bufferedKeys: string[] = [];
            const cleanKeys: string[] = [];
            let hasPendingMerges = false;

            for (const key of keys) {
                if (writeBuffer.has(key)) {
                    bufferedKeys.push(key);
                } else {
                    cleanKeys.push(key);
                    if (writeBuffer.hasAny(key)) {
                        hasPendingMerges = true;
                    }
                }
            }

            // If all keys have SET entries, skip the provider call entirely
            if (cleanKeys.length === 0) {
                return Promise.resolve(bufferedKeys.map((key) => [key, writeBuffer.get(key)]));
            }

            // If any clean keys have pending MERGE entries, flush first
            const readyPromise = hasPendingMerges ? writeBuffer.flushNow() : Promise.resolve();

            return readyPromise.then(() =>
                provider.multiGet(cleanKeys).then((providerResults) => {
                    const bufferedResults = bufferedKeys.map((key) => [key, writeBuffer.get(key)] as [string, unknown]);
                    return [...providerResults, ...bufferedResults];
                }),
            );
        }),

    /**
     * Sets the value for a given key. The value is staged in the write buffer
     * as a SET entry and flushed to storage asynchronously in a coalesced batch.
     *
     * Cross-tab broadcasting is handled by the unified worker after persistence,
     * so no InstanceSync send calls are needed here.
     */
    setItem: (key, value) =>
        tryOrDegradePerformance(() => {
            writeBuffer.set(key, value);
            return Promise.resolve();
        }),

    /**
     * Stores multiple key-value pairs. All values are staged in the write buffer
     * as SET entries and flushed to storage asynchronously in a coalesced batch.
     */
    multiSet: (pairs) =>
        tryOrDegradePerformance(() => {
            writeBuffer.setMany(pairs);
            return Promise.resolve();
        }),

    /**
     * Merging an existing value with a new one.
     * The patch is staged in the write buffer as a MERGE entry. If the key
     * already has a pending SET, the patch is applied to the full value
     * in-memory. If it already has a pending MERGE, patches are accumulated.
     * Returns immediately -- no flushNow() needed.
     */
    mergeItem: (key, change, replaceNullPatches) =>
        tryOrDegradePerformance(() => {
            writeBuffer.merge(key, change, replaceNullPatches);
            return Promise.resolve();
        }),

    /**
     * Multiple merging of existing and new values in a batch.
     * Each pair's patch is staged in the write buffer as a MERGE entry.
     * Returns immediately -- no flushNow() needed.
     */
    multiMerge: (pairs) =>
        tryOrDegradePerformance(() => {
            for (const [key, value, replaceNullPatches] of pairs) {
                writeBuffer.merge(key, value, replaceNullPatches);
            }
            return Promise.resolve();
        }),

    /**
     * Removes given key and its value.
     * Also removes the key from the write buffer if it has a pending write.
     */
    removeItem: (key) =>
        tryOrDegradePerformance(() => {
            writeBuffer.remove(key);
            return provider.removeItem(key);
        }),

    /**
     * Remove given keys and their values.
     * Also removes the keys from the write buffer if they have pending writes.
     */
    removeItems: (keys) =>
        tryOrDegradePerformance(() => {
            writeBuffer.removeMany(keys);
            return provider.removeItems(keys);
        }),

    /**
     * Clears everything. Clears the write buffer first, then the provider.
     */
    clear: () =>
        tryOrDegradePerformance(() => {
            writeBuffer.clear();
            return provider.clear();
        }),

    /**
     * Returns all available keys
     */
    getAllKeys: () => tryOrDegradePerformance(() => provider.getAllKeys()),

    /**
     * Gets the total bytes of the store
     */
    getDatabaseSize: () => tryOrDegradePerformance(() => provider.getDatabaseSize()),

    /**
     * Initializes the cross-tab sync receiver. On web, InstanceSync listens on
     * BroadcastChannel for value-bearing messages from other tabs' workers and
     * calls onStorageKeyChanged to update the cache. No send-side logic is
     * needed here -- the unified worker handles broadcasting after persistence.
     *
     * @param onStorageKeyChanged - Callback invoked when another tab changes a key
     */
    keepInstancesSync(onStorageKeyChanged) {
        // If InstanceSync shouldn't be used, it means we're on a native platform and we don't need to keep instances in sync
        if (!InstanceSync.shouldBeUsed) return;

        InstanceSync.init(onStorageKeyChanged, this);
    },
};

GlobalSettings.addGlobalSettingsChangeListener(({enablePerformanceMetrics}) => {
    if (!enablePerformanceMetrics) {
        return;
    }

    // Apply decorators
    storage.getItem = decorateWithMetrics(storage.getItem, 'Storage.getItem');
    storage.multiGet = decorateWithMetrics(storage.multiGet, 'Storage.multiGet');
    storage.setItem = decorateWithMetrics(storage.setItem, 'Storage.setItem');
    storage.multiSet = decorateWithMetrics(storage.multiSet, 'Storage.multiSet');
    storage.mergeItem = decorateWithMetrics(storage.mergeItem, 'Storage.mergeItem');
    storage.multiMerge = decorateWithMetrics(storage.multiMerge, 'Storage.multiMerge');
    storage.removeItem = decorateWithMetrics(storage.removeItem, 'Storage.removeItem');
    storage.removeItems = decorateWithMetrics(storage.removeItems, 'Storage.removeItems');
    storage.clear = decorateWithMetrics(storage.clear, 'Storage.clear');
    storage.getAllKeys = decorateWithMetrics(storage.getAllKeys, 'Storage.getAllKeys');
});

export default storage;
