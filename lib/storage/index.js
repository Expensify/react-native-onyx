import PlatformStorage from './platforms';
import NoopProvider from './providers/NoopProvider';
import InstanceSync from './InstanceSync';
import * as Logger from '../Logger';

let provider = PlatformStorage;
let shouldKeepInstancesSync = false;
let finishInitalization;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});

/**
 * Degrade performance by removing the storage provider and only using cache
 * @param {*} error - Error to be logged
 */
function degradePerformance(error) {
    Logger.logAlert(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.`);
    console.error(error);
    provider = NoopProvider;
}

/**
 * Runs a piece of code and degrades performance if certain errors are thrown
 * @param {Function} fn Async function that should be executed and checked for errors
 * @returns {Promise} The promise result of the function
 */
function tryOrDegradePerformance(fn) {
    return new Promise((resolve, reject) => {
        initPromise.then(() => {
            try {
                resolve(fn());
            } catch (error) {
                if (error && typeof error.message === 'string') {
                    if (error.message.includes('Internal error opening backing store for indexedDB.open')) {
                        degradePerformance(error);
                    }
                }

                reject(error);
            }
        });
    });
}

const Storage = {
    /**
     * Returns the storage provider currently in use
     * @returns {Object} the current storage provider
     */
    getStorageProvider() {
        return provider;
    },

    /**
     * Initializes all providers in the list of storage providers
     * and enables fallback providers if necessary
     */
    init() {
        tryOrDegradePerformance(() => {
            provider.init();
        }).finally(() => {
            finishInitalization();
        });
    },

    /**
     * Get the value of a given key or return `null` if it's not available in memory
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem: (key) => tryOrDegradePerformance(() => provider.getItem(key)),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet: (keys) => tryOrDegradePerformance(() => provider.multiGet(keys)),

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
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
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet: (pairs) => tryOrDegradePerformance(() => provider.multiSet(pairs)),

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {*} changes - the delta for a specific key
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
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
     * @param {Array<[key, value]>} pairs
     * This function also removes all nested null values from an object.
     * @return {Promise<void>}
     */
    multiMerge: (pairs) => tryOrDegradePerformance(() => provider.multiMerge(pairs)),

    /**
     * Remove given key and it's value from memory
     * @param {String} key
     * @returns {Promise<void>}
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
     * Remove given keys and their values from memory
     *
     * @param {Array} keys
     * @returns {Promise}
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
     * Clear everything from memory
     * @returns {Promise<void>}
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
     * Returns all keys available in memory
     * @returns {Promise<String[]>}
     */
    getAllKeys: () => tryOrDegradePerformance(() => provider.getAllKeys()),

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     * @returns {Promise<number>}
     */
    getDatabaseSize: () => tryOrDegradePerformance(() => provider.getDatabaseSize()),

    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync (web only)
     */
    keepInstancesSync(onStorageKeyChanged) {
        // If InstanceSync is null, it means we're on a native platform and we don't need to keep instances in sync
        if (InstanceSync == null) return;

        shouldKeepInstancesSync = true;
        InstanceSync.init(onStorageKeyChanged);
    },
};

export default Storage;
