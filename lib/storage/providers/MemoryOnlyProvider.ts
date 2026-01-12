import _ from 'underscore';
import type {OnyxKey, OnyxValue} from '../../types';
import utils from '../../utils';
import type StorageProvider from './types';
import type {StorageKeyValuePair} from './types';

type Store = Record<OnyxKey, OnyxValue<OnyxKey>>;

const storeInternal: Store = {};

const setInternal = (key: OnyxKey, value: OnyxValue<OnyxKey>) => {
    storeInternal[key] = value;
    return Promise.resolve(value);
};

const isJestRunning = typeof jest !== 'undefined';
const set = isJestRunning ? jest.fn(setInternal) : setInternal;

const provider: StorageProvider<Store> = {
    store: storeInternal,

    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'MemoryOnlyProvider',

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
        const value = provider.store[key] as OnyxValue<typeof key>;

        return Promise.resolve(value === undefined ? (null as OnyxValue<typeof key>) : value);
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     */
    multiGet(keys) {
        const getPromises = _.map(
            keys,
            (key) =>
                new Promise((resolve) => {
                    provider.getItem(key).then((value) => resolve([key, value]));
                }),
        ) as Array<Promise<StorageKeyValuePair>>;
        return Promise.all(getPromises);
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem(key, value) {
        set(key, value);

        return Promise.resolve();
    },

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet(pairs) {
        const setPromises = _.map(pairs, ([key, value]) => provider.setItem(key, value));

        return Promise.all(setPromises).then(() => undefined);
    },

    /**
     * Merging an existing value with a new one
     */
    mergeItem(key, change) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return provider.multiMerge([[key, change]]);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge(pairs) {
        for (const [key, value] of pairs) {
            const existingValue = provider.store[key] as Record<string, unknown>;

            const newValue = utils.fastMerge(existingValue, value as Record<string, unknown>, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            }).result;

            set(key, newValue);
        }

        return Promise.resolve();
    },

    /**
     * Remove given key and it's value from memory
     */
    removeItem(key) {
        delete provider.store[key];
        return Promise.resolve();
    },

    /**
     * Remove given keys and their values from memory
     */
    removeItems(keys) {
        _.each(keys, (key) => {
            delete provider.store[key];
        });
        return Promise.resolve();
    },

    /**
     * Clear everything from memory
     */
    clear() {
        // Remove all keys without changing the root object reference.
        for (const key of Object.keys(provider.store)) {
            delete provider.store[key];
        }
        return Promise.resolve();
    },

    /**
     * Returns all keys available in memory
     */
    getAllKeys() {
        return Promise.resolve(_.keys(provider.store));
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     */
    getDatabaseSize() {
        return Promise.resolve({bytesRemaining: Number.POSITIVE_INFINITY, bytesUsed: 0});
    },
};

const setMockStore = (data: Store) => {
    // Replace keys without changing the root object reference.
    for (const key of Object.keys(storeInternal)) {
        delete storeInternal[key];
    }
    Object.assign(storeInternal, data);
};

export default provider;
export {set as mockSet, storeInternal as mockStore, setMockStore};
