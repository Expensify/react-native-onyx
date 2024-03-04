import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import type StorageProvider from './providers/types';

const provider = PlatformStorage;
let shouldKeepInstancesSync = false;

type Storage = {
    getStorageProvider: () => StorageProvider;
} & StorageProvider;

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
        provider.init();
    },

    /**
     * Get the value of a given key or return `null` if it's not available
     */
    getItem: (key) => provider.getItem(key),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     */
    multiGet: (keys) => provider.multiGet(keys),

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: (key, value) => {
        const promise = provider.setItem(key, value);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.setItem(key));
        }

        return promise;
    },

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs) => provider.multiSet(pairs),

    /**
     * Merging an existing value with a new one
     */
    mergeItem: (key, changes, modifiedData) => {
        const promise = provider.mergeItem(key, changes, modifiedData);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.mergeItem(key));
        }

        return promise;
    },

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge: (pairs) => provider.multiMerge(pairs),

    /**
     * Removes given key and its value
     */
    removeItem: (key) => {
        const promise = provider.removeItem(key);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.removeItem(key));
        }

        return promise;
    },

    /**
     * Remove given keys and their values
     */
    removeItems: (keys) => {
        const promise = provider.removeItems(keys);

        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync.removeItems(keys));
        }

        return promise;
    },

    /**
     * Clears everything
     */
    clear: () => {
        if (shouldKeepInstancesSync) {
            return InstanceSync.clear(() => provider.clear());
        }

        return provider.clear();
    },

    /**
     * Returns all available keys
     */
    getAllKeys: () => provider.getAllKeys(),

    /**
     * Gets the total bytes of the store
     */
    getDatabaseSize: () => provider.getDatabaseSize(),

    /**
     * @param onStorageKeyChanged - Storage synchronization mechanism keeping all opened tabs in sync (web only)
     */
    keepInstancesSync(onStorageKeyChanged) {
        // If InstanceSync is null, it means we're on a native platform and we don't need to keep instances in sync
        if (InstanceSync == null) return;

        shouldKeepInstancesSync = true;
        InstanceSync.init(onStorageKeyChanged);
    },
};

export default Storage;
