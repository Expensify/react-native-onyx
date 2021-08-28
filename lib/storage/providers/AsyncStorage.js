/**
 * The AsyncStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */

import _ from 'underscore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Values other than null and undefined should be stringified before
 * they are saved in storage
 * @param {*} value
 * @returns {string|null}
 */
function prepareValueForStorage(value) {
    if (_.isUndefined(value) || _.isNull(value)) {
        return value;
    }

    return JSON.stringify(value);
}

const provider = {
    getItem(key) {
        return AsyncStorage.getItem(key)
            .then((value) => {
                const parsed = value && JSON.parse(value);
                return parsed;
            });
    },
    multiGet(keys) {
        return AsyncStorage.multiGet(keys)
            .then(pairs => pairs.map(([key, value]) => [key, value && JSON.parse(value)]));
    },
    setItem(key, value) {
        return AsyncStorage.setItem(key, prepareValueForStorage(value));
    },
    multiSet(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, prepareValueForStorage(value)]);
        return AsyncStorage.multiSet(stringPairs);
    },
    multiMerge(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, prepareValueForStorage(value)]);
        return AsyncStorage.multiMerge(stringPairs);
    },

    getAllKeys: AsyncStorage.getAllKeys,
    removeItem: AsyncStorage.removeItem,
    clear: AsyncStorage.clear,
};

export default provider;
