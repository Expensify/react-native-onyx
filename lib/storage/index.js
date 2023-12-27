import _ from 'underscore';
import PlatformStorage from './platforms';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import InstanceSync from './InstanceSync';

let storageProviders = [PlatformStorage, MemoryOnlyProvider];

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

function runInParallel(operationName, resolveAll = false, ...params) {
    const promises = _.map(storageProviders, (provider) => provider[operationName](...params));

    return resolveAll ? Promise.all(promises).then((values) => values[0]) : promises[0];
}

let shouldKeepInstancesSync = false;

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
        return Promise.all(
            _.map(storageProviders.slice(1), (provider) => {
                try {
                    provider.init();
                } catch (error) {
                    this.removeStorageProvider(provider);
                }
            }),
        ).then(() => {
            // If the platform storage provider can be initialized successfully, we can remove the memory only provider
            this.removeStorageProvider(MemoryOnlyProvider);
        });
    },

    /**
     * Get the value of a given key or return `null` if it's not available in memory
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem(key) {
        return runConsecutively('getItem', key);
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        return runConsecutively('multiGet', keys);
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        const promise = runInParallel('setItem', false, key, value);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.setItem(key));
        }

        return promise;
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        return runInParallel('multiSet', false, pairs);
    },

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {*} changes - the delta for a specific key
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, changes, modifiedData) {
        const promise = runInParallel('mergeItem', false, key, changes, modifiedData);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.mergeItem(key));
        }

        return promise;
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * This function also removes all nested null values from an object.
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        return runInParallel('multiMerge', false, pairs);
    },

    /**
     * Remove given key and it's value from memory
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem(key) {
        const promise = runInParallel('removeItem', false, key);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.removeItem(key));
        }

        return promise;
    },

    /**
     * Remove given keys and their values from memory
     *
     * @param {Array} keys
     * @returns {Promise}
     */
    removeItems(keys) {
        const promise = runInParallel('removeItem', false, keys);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.removeItems(keys));
        }

        return promise;
    },

    /**
     * Clear everything from memory
     * @returns {Promise<void>}
     */
    clear() {
        if (shouldKeepInstancesSync) {
            return InstanceSync.clear(() => runInParallel('removeItem', true));
        }

        return runInParallel('removeItem', true);
    },

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys() {
        return runInParallel('setMemoryOnlyKeys', true);
    },

    /**
     * Returns all keys available in memory
     * @returns {Promise<String[]>}
     */
    getAllKeys() {
        return runConsecutively('getAllKeys');
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        return runConsecutively('getDatabaseSize');
    },

    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    keepInstancesSync(onStorageKeyChanged) {
        shouldKeepInstancesSync = true;
        InstanceSync.init(onStorageKeyChanged);
    },
};

export default Storage;
