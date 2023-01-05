/**
 * The AsyncStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */

import _ from 'underscore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        const stringPairs = _.map(pairs, ([key, value]) => [key, JSON.stringify(value)]);
        return AsyncStorage.multiMerge(stringPairs);
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
     * Clear most things from storage
     * @param {Array} keyValuesToPreserve a set of key value pairs to keep in Onyx after doing a full clear. This argument
     *      is here to provide a performance boost when deleting a majority of keys, but wanting to keep only a few.
     *      Example: It's faster than doing a big multiRemove() which is just a loop that calls removeItem().
     * @returns {Promise<void>}
     */
    clear(keyValuesToPreserve) {
        return AsyncStorage.clear()
            .then(() => this.multiSet(keyValuesToPreserve));
    },
};

export default provider;
