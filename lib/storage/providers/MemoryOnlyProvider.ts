import _ from 'underscore';
import utils from '../../utils';
import type StorageProvider from './types';
import type {KeyValuePair} from './types';
import type {OnyxKey, OnyxValue} from '../../types';

type Store = Record<OnyxKey, OnyxValue<OnyxKey>>;

// eslint-disable-next-line import/no-mutable-exports
let store: Store = {};

const setInternal = (key: OnyxKey, value: OnyxValue<OnyxKey>) => {
    store[key] = value;
    return Promise.resolve(value);
};

const isJestRunning = typeof jest !== 'undefined';
const set = isJestRunning ? jest.fn(setInternal) : setInternal;

const provider: StorageProvider = {
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
        const value = store[key] as OnyxValue<typeof key>;

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
                    this.getItem(key).then((value) => resolve([key, value]));
                }),
        ) as Array<Promise<KeyValuePair>>;
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
        const setPromises = _.map(pairs, ([key, value]) => this.setItem(key, value));

        return Promise.all(setPromises).then(() => undefined);
    },

    /**
     * Merging an existing value with a new one
     */
    mergeItem(key, _deltaChanges, preMergedValue) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly
        return this.setItem(key, preMergedValue);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge(pairs) {
        _.forEach(pairs, ([key, value]) => {
            const existingValue = store[key] as Record<string, unknown>;
            const newValue = utils.fastMerge(existingValue, value as Record<string, unknown>) as OnyxValue<OnyxKey>;

            set(key, newValue);
        });

        return Promise.resolve([]);
    },

    /**
     * Remove given key and it's value from memory
     */
    removeItem(key) {
        delete store[key];
        return Promise.resolve();
    },

    /**
     * Remove given keys and their values from memory
     */
    removeItems(keys) {
        _.each(keys, (key) => {
            delete store[key];
        });
        return Promise.resolve();
    },

    /**
     * Clear everything from memory
     */
    clear() {
        store = {};
        return Promise.resolve();
    },

    /**
     * Returns all keys available in memory
     */
    getAllKeys() {
        return Promise.resolve(_.keys(store));
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
    store = data;
};

export default provider;
export {store as mockStore, set as mockSet, setMockStore};
