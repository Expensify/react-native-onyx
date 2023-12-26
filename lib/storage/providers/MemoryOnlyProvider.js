import _ from 'underscore';
import sizeof from 'object-sizeof';
import utils from '../../utils';

const isJestRunning = process.env.JEST_WORKER_ID !== undefined;

// eslint-disable-next-line import/no-mutable-exports
let store = {};

const setInternal = (key, value) => {
    store[key] = value;
    return Promise.resolve(value);
};

const set = isJestRunning ? jest.fn(setInternal) : setInternal;

const provider = {
    /**
     * Get the value of a given key or return `null` if it's not available in memory
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem(key) {
        return Promise.resolve(store[key]);
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        const getPromises = _.map(keys, (key) => new Promise((resolve) => this.getItem(key).then((value) => resolve([key, value]))));
        return Promise.all(getPromises);
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return set(key, value);
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        const setPromises = _.map(pairs, ([key, value]) => this.setItem(key, value));
        return new Promise((resolve) => Promise.all(setPromises).then(() => resolve(store)));
    },

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {any} _changes - not used, as we rely on the pre-merged data from the `modifiedData`
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, _changes, modifiedData) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly
        return this.setItem(key, modifiedData);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * This function also removes all nested null values from an object.
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        _.forEach(pairs, ([key, value]) => {
            const existingValue = store[key];
            const newValue = utils.fastMerge(existingValue, value);

            set(key, newValue);
        });

        return Promise.resolve(store);
    },

    /**
     * Remove given key and it's value from memory
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem(key) {
        delete store[key];
        return Promise.resolve();
    },

    /**
     * Remove given keys and their values from memory
     *
     * @param {Array} keys
     * @returns {Promise}
     */
    removeItems(keys) {
        _.each(keys, (key) => {
            delete store[key];
        });
        return Promise.resolve();
    },

    /**
     * Clear everything from memory
     * @returns {Promise<void>}
     */
    clear() {
        store = {};
        return Promise.resolve();
    },

    // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
    setMemoryOnlyKeys() {},

    /**
     * Returns all keys available in memory
     * @returns {Promise<String[]>}
     */
    getAllKeys() {
        return Promise.resolve(_.keys(store));
    },

    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        const storeSize = sizeof(store);

        return Promise.resolve({bytesRemaining: Number.POSITIVE_INFINITY, bytesUsed: storeSize});
    },
};

export default provider;
export {store, set};
