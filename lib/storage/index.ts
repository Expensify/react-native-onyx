import * as Logger from '../Logger';

import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import type StorageProvider from './providers/types';
import * as GlobalSettings from '../GlobalSettings';
import decorateWithMetrics from '../metrics';
import DirtyMap from './DirtyMap';

let provider = PlatformStorage as StorageProvider<unknown>;
let shouldKeepInstancesSync = false;
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
 * The DirtyMap is a patch-staging layer between Onyx's cache and the storage
 * provider. It tracks two types of pending entries:
 * - SET entries (full values) flushed via provider.multiSet()
 * - MERGE entries (accumulated patches) flushed via provider.multiMerge(),
 *   preserving JSON_PATCH efficiency on SQLite
 *
 * All writes (set, merge) return immediately after staging in the DirtyMap.
 * Persistence happens asynchronously in coalesced batches.
 */
const dirtyMap = new DirtyMap({
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
     * Checks the dirty map for pending SET entries first. MERGE entries
     * (patches) are not served since they don't contain complete values.
     */
    getItem: (key) =>
        tryOrDegradePerformance(() => {
            // Read-through: check the dirty map for SET entries
            if (dirtyMap.has(key)) {
                return Promise.resolve(dirtyMap.get(key));
            }
            return provider.getItem(key);
        }),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * Overlays dirty map SET values on top of provider results.
     */
    multiGet: (keys) =>
        tryOrDegradePerformance(() => {
            // Split keys into those with SET entries (in memory) and the rest (need provider read)
            const dirtyKeys: string[] = [];
            const cleanKeys: string[] = [];

            for (const key of keys) {
                if (dirtyMap.has(key)) {
                    dirtyKeys.push(key);
                } else {
                    cleanKeys.push(key);
                }
            }

            // If all keys have SET entries, skip the provider call entirely
            if (cleanKeys.length === 0) {
                return Promise.resolve(dirtyKeys.map((key) => [key, dirtyMap.get(key)]));
            }

            return provider.multiGet(cleanKeys).then((providerResults) => {
                // Merge dirty values with provider results
                const dirtyResults = dirtyKeys.map((key) => [key, dirtyMap.get(key)] as [string, unknown]);
                return [...providerResults, ...dirtyResults];
            });
        }),

    /**
     * Sets the value for a given key. The value is staged in the dirty map
     * as a SET entry and flushed to storage asynchronously in a coalesced batch.
     */
    setItem: (key, value) =>
        tryOrDegradePerformance(() => {
            dirtyMap.set(key, value);

            if (shouldKeepInstancesSync) {
                InstanceSync.setItem(key);
            }

            return Promise.resolve();
        }),

    /**
     * Stores multiple key-value pairs. All values are staged in the dirty map
     * as SET entries and flushed to storage asynchronously in a coalesced batch.
     */
    multiSet: (pairs) =>
        tryOrDegradePerformance(() => {
            dirtyMap.setMany(pairs);

            if (shouldKeepInstancesSync) {
                InstanceSync.multiSet(pairs.map((pair) => pair[0]));
            }

            return Promise.resolve();
        }),

    /**
     * Merging an existing value with a new one.
     * The patch is staged in the dirty map as a MERGE entry. If the key
     * already has a pending SET, the patch is applied to the full value
     * in-memory. If it already has a pending MERGE, patches are accumulated.
     * Returns immediately -- no flushNow() needed.
     */
    mergeItem: (key, change, replaceNullPatches) =>
        tryOrDegradePerformance(() => {
            dirtyMap.merge(key, change, replaceNullPatches);

            if (shouldKeepInstancesSync) {
                InstanceSync.mergeItem(key);
            }

            return Promise.resolve();
        }),

    /**
     * Multiple merging of existing and new values in a batch.
     * Each pair's patch is staged in the dirty map as a MERGE entry.
     * Returns immediately -- no flushNow() needed.
     */
    multiMerge: (pairs) =>
        tryOrDegradePerformance(() => {
            for (const [key, value, replaceNullPatches] of pairs) {
                dirtyMap.merge(key, value, replaceNullPatches);
            }

            if (shouldKeepInstancesSync) {
                InstanceSync.multiMerge(pairs.map((pair) => pair[0]));
            }

            return Promise.resolve();
        }),

    /**
     * Removes given key and its value.
     * Also removes the key from the dirty map if it has a pending write.
     */
    removeItem: (key) =>
        tryOrDegradePerformance(() => {
            dirtyMap.remove(key);
            const promise = provider.removeItem(key);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItem(key));
            }

            return promise;
        }),

    /**
     * Remove given keys and their values.
     * Also removes the keys from the dirty map if they have pending writes.
     */
    removeItems: (keys) =>
        tryOrDegradePerformance(() => {
            dirtyMap.removeMany(keys);
            const promise = provider.removeItems(keys);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItems(keys));
            }

            return promise;
        }),

    /**
     * Clears everything. Clears the dirty map first, then the provider.
     */
    clear: () =>
        tryOrDegradePerformance(() => {
            dirtyMap.clear();

            if (shouldKeepInstancesSync) {
                return InstanceSync.clear(() => provider.clear());
            }

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
     * @param onStorageKeyChanged - Storage synchronization mechanism keeping all opened tabs in sync (web only)
     */
    keepInstancesSync(onStorageKeyChanged) {
        // If InstanceSync shouldn't be used, it means we're on a native platform and we don't need to keep instances in sync
        if (!InstanceSync.shouldBeUsed) return;

        shouldKeepInstancesSync = true;
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
