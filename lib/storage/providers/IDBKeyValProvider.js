import {set, keys, getMany, setMany, get, clear, del, delMany, createStore, promisifyRequest} from 'idb-keyval';
import _ from 'underscore';
import utils from '../../utils';

// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let idbKeyValStore;

const provider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'IDBKeyValProvider',

    /**
     * Initializes the storage provider
     */
    init() {
        idbKeyValStore = createStore('OnyxDB', 'keyvaluepairs');
    },

    /**
     * Get the value of a given key or return `null` if it's not available in storage
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem: (key) =>
        get(key, idbKeyValStore)
            // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
            .then((val) => (val === undefined ? null : val)),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * This is optimized to use only one database transaction.
     * @param {String[]} keysParam
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet: (keysParam) => getMany(keysParam, idbKeyValStore).then((values) => _.map(values, (value, index) => [keysParam[index], value])),

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem: (key, value) => set(key, value, idbKeyValStore),

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet: (pairs) => setMany(pairs, idbKeyValStore),

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {any} _changes - not used, as we rely on the pre-merged data from the `modifiedData`
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, _changes, modifiedData) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, modifiedData);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * This function also removes all nested null values from an object.
     * @return {Promise<void>}
     */
    multiMerge: (pairs) =>
        idbKeyValStore('readwrite', (store) => {
            // Note: we are using the manual store transaction here, to fit the read and update
            // of the items in one transaction to achieve best performance.

            const getValues = Promise.all(_.map(pairs, ([key]) => promisifyRequest(store.get(key))));

            return getValues.then((values) => {
                const upsertMany = _.map(pairs, ([key, value], index) => {
                    const prev = values[index];
                    const newValue = utils.fastMerge(prev, value);
                    return promisifyRequest(store.put(newValue, key));
                });
                return Promise.all(upsertMany);
            });
        }),

    /**
     * Remove given key and it's value from storage
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem: (key) => del(key, idbKeyValStore),

    /**
     * Remove given keys and their values from storage
     *
     * @param {Array} keysParam
     * @returns {Promise}
     */
    removeItems: (keysParam) => delMany(keysParam, idbKeyValStore),

    /**
     * Clear everything from storage
     * @returns {Promise<void>}
     */
    clear: () => clear(idbKeyValStore),

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys: () => {},

    /**
     * Returns all keys available in storage
     * @returns {Promise<String[]>}
     */
    getAllKeys: () => keys(idbKeyValStore),

    /**
     * Gets the total bytes of the database file
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        if (!window.navigator || !window.navigator.storage) {
            throw new Error('StorageManager browser API unavailable');
        }

        return window.navigator.storage
            .estimate()
            .then((value) => ({
                bytesUsed: value.usage,
                bytesRemaining: value.quota - value.usage,
            }))
            .catch((error) => {
                throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
            });
    },
};

export default provider;
