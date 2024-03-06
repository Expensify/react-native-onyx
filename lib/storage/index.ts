import * as Logger from '../Logger';

import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import NoopProvider from './providers/NoopProvider';
import type StorageProvider from './providers/types';

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
    Logger.logAlert(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.`);
    console.error(error);
    provider = NoopProvider;
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
                }

                reject(error);
            }
        });
    });
}

const Storage: Storage = {
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
    multiSet: (pairs) => tryOrDegradePerformance(() => provider.multiSet(pairs)),

    /**
     * Merging an existing value with a new one
     */
    mergeItem: (key, changes, modifiedData) =>
        tryOrDegradePerformance(() => {
            const promise = provider.mergeItem(key, changes, modifiedData);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.mergeItem(key));
            }

            return promise;
        }),

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge: (pairs) => tryOrDegradePerformance(() => provider.multiMerge(pairs)),

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

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys: () => tryOrDegradePerformance(() => provider.setMemoryOnlyKeys()),

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
        // If InstanceSync is null, it means we're on a native platform and we don't need to keep instances in sync
        if (InstanceSync === null) return;

        shouldKeepInstancesSync = true;
        InstanceSync.init(onStorageKeyChanged, this);
    },
};

export default Storage;
