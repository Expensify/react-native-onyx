import type {OnyxValue} from '../../types';
import type StorageProvider from './types';

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'NoopProvider',

    /**
     * Initializes the storage provider
     */
    init() {
        // do nothing
    },

    /**
     * Get the value of a given key or return `null` if it's not available in memory
     */
    getItem(key) {
        return Promise.resolve(null as OnyxValue<typeof key>);
    },

    /**
     * Get the value of a given key synchronously or return `null` if it's not available in memory
     */
    getItemSync(key) {
        return null as OnyxValue<typeof key>;
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     */
    multiGet() {
        return Promise.resolve([]);
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem() {
        return Promise.resolve();
    },

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet() {
        return Promise.resolve();
    },

    /**
     * Merging an existing value with a new one
     */
    mergeItem() {
        return Promise.resolve();
    },

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge() {
        return Promise.resolve([]);
    },

    /**
     * Remove given key and it's value from memory
     */
    removeItem() {
        return Promise.resolve();
    },

    /**
     * Remove given keys and their values from memory
     */
    removeItems() {
        return Promise.resolve();
    },

    /**
     * Clear everything from memory
     */
    clear() {
        return Promise.resolve();
    },

    /**
     * Returns all keys available in memory
     */
    getAllKeys() {
        return Promise.resolve([]);
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     */
    getDatabaseSize() {
        return Promise.resolve({bytesRemaining: Number.POSITIVE_INFINITY, bytesUsed: 0});
    },
};

export default provider;
