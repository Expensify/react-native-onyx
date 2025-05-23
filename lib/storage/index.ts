import Logger from '../Logger';

import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import type StorageProvider from './providers/types';
import * as GlobalSettings from '../GlobalSettings';
import decorateWithMetrics from '../metrics';

let provider = PlatformStorage;
let shouldKeepInstancesSync = false;
let finishInitalization: (value?: unknown) => void;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});

type Storage = {
    getStorageProvider: () => StorageProvider;
} & Omit<StorageProvider, 'name'>;

/**
 * Degrade performance by removing the storage provider and only using cache
 */
function degradePerformance(error: Error) {
    Logger.logHmmm(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.\n Error: ${error.message}\n Stack: ${error.stack}\n Cause: ${error.cause}`);
    console.error(error);
    provider = MemoryOnlyProvider;
}

/**
 * Runs a piece of code synchronously and degrades performance if certain errors are thrown
 */
function tryOrDegradePerformanceSync<T, Callback extends (() => Promise<T>) | (() => T)>(fn: Callback): ReturnType<Callback> {
    try {
        return fn() as ReturnType<Callback>;
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

        throw error;
    }
}

/**
 * Runs a piece of code and degrades performance if certain errors are thrown
 */
function tryOrDegradePerformance<T>(fn: () => Promise<T> | T, waitForInitialization = true) {
    return (waitForInitialization ? initPromise : Promise.resolve()).then(() => tryOrDegradePerformanceSync(fn));
}

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
     * Get the value of a given key or return `null` if it's not available
     */
    getItem: (key) => tryOrDegradePerformance(() => provider.getItem(key)),

    /**
     * Get the value of a given key synchronously or return `null` if it's not available
     */
    getItemSync: (key) => tryOrDegradePerformanceSync(() => provider.getItemSync(key)),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     */
    multiGet: (keys) => tryOrDegradePerformance(() => provider.multiGet(keys)),

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: (key, value) =>
        tryOrDegradePerformance(() => {
            const promise = provider.setItem(key, value);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.setItem(key));
            }

            return promise;
        }),

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs) =>
        tryOrDegradePerformance(() => {
            const promise = provider.multiSet(pairs);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.multiSet(pairs.map((pair) => pair[0])));
            }

            return promise;
        }),

    /**
     * Merging an existing value with a new one
     */
    mergeItem: (key, change) =>
        tryOrDegradePerformance(() => {
            const promise = provider.mergeItem(key, change);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.mergeItem(key));
            }

            return promise;
        }),

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge: (pairs) =>
        tryOrDegradePerformance(() => {
            const promise = provider.multiMerge(pairs);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.multiMerge(pairs.map((pair) => pair[0])));
            }

            return promise;
        }),

    /**
     * Removes given key and its value
     */
    removeItem: (key) =>
        tryOrDegradePerformance(() => {
            const promise = provider.removeItem(key);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItem(key));
            }

            return promise;
        }),

    /**
     * Remove given keys and their values
     */
    removeItems: (keys) =>
        tryOrDegradePerformance(() => {
            const promise = provider.removeItems(keys);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItems(keys));
            }

            return promise;
        }),

    /**
     * Clears everything
     */
    clear: () =>
        tryOrDegradePerformance(() => {
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
