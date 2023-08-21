import {
    set,
    keys,
    getMany,
    setMany,
    get,
    clear,
    del,
    delMany,
    createStore,
    promisifyRequest,
} from 'idb-keyval';
import _ from 'underscore';
import fastMerge from '../../fastMerge';

const customStore = createStore('OnyxDB', 'keyvaluepairs');

const provider = {
    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem: (key, value) => set(key, value, customStore),

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * This is optimized to use only one database transaction.
     * @param {String[]} keysParam
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet: keysParam => getMany(keysParam, customStore)
        .then(values => _.map(values, (value, index) => [keysParam[index], value])),

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiMerge: pairs => customStore('readwrite', (store) => {
        // Note: we are using the manual store transaction here, to fit the read and update
        // of the items in one transaction to achieve best performance.

        const getValues = Promise.all(_.map(pairs, ([key]) => promisifyRequest(store.get(key))));

        return getValues.then((values) => {
            const upsertMany = _.map(pairs, ([key, value], index) => {
                const prev = values[index];
                const newValue = _.isObject(prev) ? fastMerge(prev, value) : value;
                return promisifyRequest(store.put(newValue, key));
            });
            return Promise.all(upsertMany);
        });
    }),

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {any} _changes - not used, as we rely on the pre-merged data from the `modifiedData`
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, _changes, modifiedData) {
        return provider.multiMerge([[key, modifiedData]]);
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet: pairs => setMany(pairs, customStore),

    /**
     * Clear everything from storage and also stops the SyncQueue from adding anything more to storage
     * @returns {Promise<void>}
     */
    clear: () => clear(customStore),

    /**
     * Returns all keys available in storage
     * @returns {Promise<String[]>}
     */
    getAllKeys: () => keys(customStore),

    /**
     * Get the value of a given key or return `null` if it's not available in storage
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem: key => get(key, customStore),

    /**
     * Remove given key and it's value from storage
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem: key => del(key, customStore),

    /**
     * Remove given keys and their values from storage
     *
     * @param {Array} keysParam
     * @returns {Promise}
     */
    removeItems: keysParam => delMany(keysParam, customStore),
};

export default provider;
