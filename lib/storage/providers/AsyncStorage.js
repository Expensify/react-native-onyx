/**
 * The AsyncStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */

import _ from 'underscore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import applyMerge from '../../applyMerge';
import * as Logger from '../../Logger';

// Key/value store of Onyx key and arrays of values to merge
const mergeQueue = {};

const provider = {
    /**
     * Get the value of a given key or return `null` if it's not available in storage
     * @param {String} key
     * @return {Promise<*>}
     */
    getItem(key) {
        return AsyncStorage.getItem(key)
            .then((value) => {
                const parsed = value && JSON.parse(value);
                return parsed;
            });
    },

    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     * @param {String[]} keys
     * @return {Promise<Array<[key, value]>>}
     */
    multiGet(keys) {
        return AsyncStorage.multiGet(keys)
            .then(pairs => _.map(pairs, ([key, value]) => [key, value && JSON.parse(value)]));
    },

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     * @param {String} key
     * @param {*} value
     * @return {Promise<void>}
     */
    setItem(key, value) {
        return AsyncStorage.setItem(key, JSON.stringify(value));
    },

    /**
     * Stores multiple key-value pairs in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiSet(pairs) {
        const stringPairs = _.map(pairs, ([key, value]) => [key, JSON.stringify(value)]);
        return AsyncStorage.multiSet(stringPairs);
    },

    /**
     * Multiple merging of existing and new values in a batch
     * @param {Array<[key, value]>} pairs
     * @return {Promise<void>}
     */
    multiMerge(pairs) {
        const tasks = _.map(pairs, ([key, value, currentValue]) => {
            if (mergeQueue[key]) {
                mergeQueue[key].push(value);
                return Promise.resolve();
            }

            mergeQueue[key] = [value];

            try {
                const modifiedData = applyMerge(key, currentValue, mergeQueue);

                // Clean up the write queue so we
                // don't apply these changes again
                delete mergeQueue[key];

                return this.setItem(key, modifiedData).then(() => Promise.resolve());
            } catch (error) {
                Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
            }

            return Promise.resolve();
        });

        // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
        return Promise.all(tasks).then(() => Promise.resolve());
    },

    mergeItem(key, value, currentValue) {
        return this.multiMerge([[key, value, currentValue]]);
    },

    /**
     * Returns all keys available in storage
     * @returns {Promise<String[]>}
     */
    getAllKeys: AsyncStorage.getAllKeys,

    /**
     * Remove given key and it's value from storage
     * @param {String} key
     * @returns {Promise<void>}
     */
    removeItem: AsyncStorage.removeItem,

    /**
     * Clear everything from storage
     * @returns {Promise<void>}
     */
    clear: AsyncStorage.clear,
};

export default provider;
