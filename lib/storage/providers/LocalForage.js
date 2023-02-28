/**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */

import localforage from 'localforage';
import _ from 'underscore';
import SyncQueue from '../../SyncQueue';
import fastMerge from '../../fastMerge';
import * as Logger from '../../Logger';

localforage.config({
    name: 'OnyxDB',
});

// Key/value store of Onyx key and arrays of values to merge
const mergeQueue = {};

/**
 * Given an Onyx key and value this method will combine all queued
 * value updates and return a single value. Merge attempts are
 * batched. They must occur after a single call to get() so we
 * can avoid race conditions.
 *
 * @private
 * @param {String} key
 * @param {*} data
 *
 * @returns {*}
 */
function applyMerge(key, data) {
    const mergeValues = mergeQueue[key];
    if (_.isArray(data) || _.every(mergeValues, _.isArray)) {
        // Array values will always just concatenate
        // more items onto the end of the array
        return _.reduce(mergeValues, (modifiedData, mergeValue) => [
            ...modifiedData,
            ...mergeValue,
        ], data || []);
    }

    if (_.isObject(data) || _.every(mergeValues, _.isObject)) {
        // Object values are merged one after the other
        return _.reduce(mergeValues, (modifiedData, mergeValue) => {
            // lodash adds a small overhead so we don't use it here
            // eslint-disable-next-line prefer-object-spread, rulesdir/prefer-underscore-method
            const newData = Object.assign({}, fastMerge(modifiedData, mergeValue));

            // We will also delete any object keys that are undefined or null.
            // Deleting keys is not supported by AsyncStorage so we do it this way.
            // Remove all first level keys that are explicitly set to null.
            return _.omit(newData, (value, finalObjectKey) => _.isNull(mergeValue[finalObjectKey]));
        }, data || {});
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return _.last(mergeValues);
}

const provider = {
    /**
     * Writing very quickly to IndexedDB causes performance issues and can lock up the page and lead to jank.
     * So, we are slowing this process down by waiting until one write is complete before moving on
     * to the next.
     */
    setItemQueue: new SyncQueue(({key, value, shouldMerge}) => {
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
        const tasks = _.map(pairs, ([key, value]) => {
            if (mergeQueue[key]) {
                mergeQueue[key].push(value);
                return Promise.resolve();
            }

            mergeQueue[key] = [value];
            Storage.getItem(key).then((data) => {
                try {
                    const modifiedData = applyMerge(key, data);

                    // Clean up the write queue so we
                    // don't apply these changes again
                    delete mergeQueue[key];

                    this.setItemQueue.push({key, modifiedData, shouldMerge: true}).then(() => Promise.resolve());
                } catch (error) {
                    Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
                }

                return Promise.resolve();
            });
        });

        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    mergeItem(key, value) {
        return this.multiMerge([[key, value]]);
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
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return this.setItemQueue.push({key, value});
    },

    hasPendingMergeForQueue(key) {
        return Boolean(mergeQueue[key]);
    },
};

export default provider;
