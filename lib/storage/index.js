import _ from 'underscore';
import PlatformStorage from './platforms';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import InstanceSync from './InstanceSync';
import * as Logger from '../Logger';

let storageProviders = [PlatformStorage, MemoryOnlyProvider];
let finishInitalization;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});
let shouldKeepInstancesSync = false;

/**
 * Runs an operation consecutively on all storage providers
 * For operations like "getItem", "multiGet" and "getAllKeys" we want to
 * get the value from the first provider in the list of storage providers
 * If the first storage provider fails to deliver the output,
 * we go for the next one and so on.
 * @param {String} operationName
 * @param {Array<any>} params - the parameters to pass to the operation
 * @return {Promise<void>}
 */
function runConsecutively(operationName, ...params) {
    const runOperation = (providerIndex) => {
        const provider = storageProviders[providerIndex];

        return new Promise((resolve, reject) => {
            provider[operationName](...params)
                .then(resolve)
                .catch((error) => {
                    if (providerIndex + 1 >= storageProviders.length) {
                        reject(error);
                        return;
                    }

                    runOperation(providerIndex + 1)
                        .then(resolve)
                        .catch(reject);
                });
        });
    };

    return runOperation(0);
}

/**
 * Runs an operation in parallel on all storage providers
 * For operations like "setItem", "multiSet" and "removeItem" we want to
 * run the operation on all storage providers in parallel, but we only
 * care about the first one to resolve with the output.
 * Otherwise if "resolveAll" is enabled, we wait for all providers to resolve
 * @param {String} operationName
 * @param {Boolean} resolveAll - whether the function should wait for all providers to resolve or just the first one
 * @param {Array<any>} params - the parameters to pass to the operation
 * @return {Promise<void>}
 */
function runInParallel(operationName, resolveAll = false, ...params) {
    const promises = _.map(storageProviders, (provider) => provider[operationName](...params));

    return resolveAll ? Promise.all(promises).then((values) => values[0]) : promises[0];
}

/**
 * Runs an operation in parallel for all storage providers
 * @param {Function} callback - a callback that should be run after initialization
 * @param {Array<any>} params - the parameters to pass to the operation
 * @return {Promise<void>}
 */
const runAfterInit = (callback, ...params) =>
    new Promise((resolve, reject) => {
        initPromise.then(() => {
            callback(...params)
                .then(resolve)
                .catch(reject);
        });
    });

const Storage = {
    getStorageProviders() {
        return storageProviders;
    },
    addStorageProvider(provider) {
        storageProviders.push(provider);
    },
    removeStorageProvider(provider) {
        storageProviders = _.without(storageProviders, provider);
    },

    init() {
        // If a storage provider fails to initialize, we remove it from the list of providers
        // We don't want to remove the "memory only" provider though, therefore, we start at index 1
        let isUsingFallback = false;
        _.forEach(storageProviders, (provider) => {
            try {
                provider.init();
            } catch (error) {
                // If the MemoryOnlyProvider fails to initialize somehow (technically impossible),
                // we still don't want to remove it since it's the fallback
                if (provider !== MemoryOnlyProvider) {
                    isUsingFallback = true;
                    this.removeStorageProvider(provider);
                }

                Logger.logAlert(`${provider.name} could not be initialized. Falling back to the memory-only provider instead.`);
                console.error(error);
            }
        });

        if (!isUsingFallback) {
            // If the platform storage provider can be initialized successfully, we can remove the memory only provider
            this.removeStorageProvider(MemoryOnlyProvider);
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
        return runAfterInit(() => runConsecutively('getItem', key));
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        return runAfterInit(() => runConsecutively('multiGet', keys));
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return runAfterInit(() => {
            const promise = runInParallel('setItem', false, key, value);

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
        return runAfterInit(() => runInParallel('multiSet', false, pairs));
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
            const promise = runInParallel('mergeItem', false, key, changes, modifiedData);

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
        return runAfterInit(() => runInParallel('multiMerge', false, pairs));
    },

    /**
     * Remove given key and it's value from memory
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem(key) {
        return runAfterInit(() => {
            const promise = runInParallel('removeItem', false, key);

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
            const promise = runInParallel('removeItem', false, keys);

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
                return InstanceSync.clear(() => runInParallel('removeItem', true));
            }

            return runInParallel('removeItem', true);
        });
    },

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys() {
        return runAfterInit(() => runInParallel('setMemoryOnlyKeys', true));
    },

    /**
     * Returns all keys available in memory
     * @returns {Promise<String[]>}
     */
    getAllKeys() {
        return runAfterInit(() => runConsecutively('getAllKeys'));
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        return runAfterInit(() => runConsecutively('getDatabaseSize'));
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
