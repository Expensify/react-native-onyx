/**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */

import localforage from 'localforage';
import _ from 'underscore';
import {extendPrototype} from 'localforage-removeitems';
import SyncQueue from '../../SyncQueue';
import * as Str from '../../Str';
import fastMerge from '../../fastMerge';

extendPrototype(localforage);

localforage.config({
    name: 'OnyxDB',
});

/**
 * Keys that will not ever be persisted to disk.
 */
let memoryOnlyKeys = [];

const provider = {
    /**
     * Writing very quickly to IndexedDB causes performance issues and can lock up the page and lead to jank.
     * So, we are slowing this process down by waiting until one write is complete before moving on
     * to the next.
     */
    setItemQueue: new SyncQueue(({key, value, shouldMerge}) => {
        if (_.find(memoryOnlyKeys, noCacheKey => Str.startsWith(key, noCacheKey))) {
            return Promise.resolve();
        }

        if (shouldMerge) {
            return localforage.getItem(key)
                .then((existingValue) => {
                    const newValue = _.isObject(existingValue)

                        // lodash adds a small overhead so we don't use it here
                        // eslint-disable-next-line prefer-object-spread, rulesdir/prefer-underscore-method
                        ? Object.assign({}, fastMerge(existingValue, value))
                        : value;
                    return localforage.setItem(key, newValue);
                });
        }

        return localforage.setItem(key, value);
    }),

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return this.setItemQueue.push({key, value});
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        const pairs = _.map(
            keys,
            key => localforage.getItem(key)
                .then(value => [key, value]),
        );

        return Promise.all(pairs);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        const tasks = _.map(pairs, ([key, value]) => this.setItemQueue.push({key, value, shouldMerge: true}));

        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    /**
     * Merging an existing value with a new one
     * @param {String} key
     * @param {any} _changes - not used, as we rely on the pre-merged data from the `modifiedData`
     * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
     * @return {Promise<void>}
     */
    mergeItem(key, _changes, modifiedData) {
        return this.setItem(key, modifiedData);
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        const tasks = _.map(pairs, ([key, value]) => this.setItem(key, value));
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    /**
     * Clear everything from storage and also stops the SyncQueue from adding anything more to storage
     * @returns {Promise<void>}
     */
    clear() {
        this.setItemQueue.abort();
        return localforage.clear();
    },

    /**
     * Returns all keys available in storage
     * @returns {Promise<String[]>}
     */
    getAllKeys: localforage.keys,

    /**
     * Get the value of a given key or return `null` if it's not available in storage
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem: localforage.getItem,

    /**
     * Remove given key and it's value from storage
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem: localforage.removeItem,

    /**
     * Remove given keys and their values from storage
     *
     * @param {Array} keys
     * @returns {Promise}
     */
    removeItems(keys) {
        return localforage.removeItems(keys);
    },

    /**
     * @param {string[]} keyList
     */
    setMemoryOnlyKeys(keyList) {
        memoryOnlyKeys = keyList;
    },

    /**
     * Gets the total bytes of the database file
     * @returns {Promise<number>}
     */
    getDatabaseSize() {
        if (!window.navigator || !window.navigator.storage) {
            throw new Error('StorageManager browser API unavailable');
        }

        return window.navigator.storage.estimate()
            .then(value => ({
                bytesUsed: value.usage,
                bytesRemaining: value.quota - value.usage,
            }))
            .catch((error) => {
                throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
            });
    },
};

export default provider;
