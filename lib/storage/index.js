import PlatformStorage from './platforms';
import NoopProvider from './providers/NoopProvider';
import InstanceSync from './InstanceSync';
import * as Logger from '../Logger';

let provider = PlatformStorage;
let finishInitalization;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});
let shouldKeepInstancesSync = false;

/**
 * Runs an operation after the storage layer has been initialized
 * @param {Function} callback - a callback that should be run after initialization
 * @param {Array<any>} params - the parameters to pass to the operation
 * @return {Promise<void>}
 */
const runAfterInit = (callback, ...params) =>
    new Promise((resolve, reject) =>
        initPromise.then(() =>
            callback(...params)
                .then(resolve)
                .catch(reject),
        ),
    );

const Storage = {
    getStorageProvider() {
        return provider;
    },

    /**
     * Initializes all providers in the list of storage providers
     * and enables fallback providers if necessary
     * @return {Boolean} whether a fallback provider is being used
     */
    init() {
        // If a storage provider fails to initialize, we remove it from the list of providers
        // We don't want to remove the "memory only" provider though, therefore, we start at index 1
        let isUsingFallback = false;

        try {
            provider.init();
        } catch (error) {
            Logger.logAlert(`${provider.name} could not be initialized. Falling back to the memory-only provider instead.`);
            console.error(error);

            provider = NoopProvider;
            isUsingFallback = true;
        }

        finishInitalization();

        return isUsingFallback;
    },

    /**
     * Get the value of a given key or return `null` if it's not available in memory
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem(key) {
        return runAfterInit(() => provider.getItem(key));
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        return runAfterInit(() => provider.multiGet(keys));
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return runAfterInit(() => {
            const promise = provider.setItem(key, value);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.setItem(key));
            }

            return promise;
        });
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        return runAfterInit(() => provider.multiSet(pairs));
    },

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {*} changes - the delta for a specific key
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, changes, modifiedData) {
        return runAfterInit(() => {
            const promise = provider.mergeItem(key, changes, modifiedData);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.mergeItem(key));
            }

            return promise;
        });
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * This function also removes all nested null values from an object.
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        return runAfterInit(() => provider.multiMerge(pairs));
    },

    /**
     * Remove given key and it's value from memory
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem(key) {
        return runAfterInit(() => {
            const promise = provider.removeItem(key);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItem(key));
            }

            return promise;
        });
    },

    /**
     * Remove given keys and their values from memory
     *
     * @param {Array} keys
     * @returns {Promise}
     */
    removeItems(keys) {
        return runAfterInit(() => {
            const promise = provider.removeItems(keys);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItems(keys));
            }

            return promise;
        });
    },

    /**
     * Clear everything from memory
     * @returns {Promise<void>}
     */
    clear() {
        return runAfterInit(() => {
            if (shouldKeepInstancesSync) {
                return InstanceSync.clear(() => provider.clear());
            }

            return provider.clear();
        });
    },

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys() {
        return runAfterInit(() => provider.setMemoryOnlyKeys());
    },

    /**
     * Returns all keys available in memory
     * @returns {Promise<String[]>}
     */
    getAllKeys() {
        return runAfterInit(() => provider.getAllKeys());
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        return runAfterInit(() => provider.getDatabaseSize());
    },

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
