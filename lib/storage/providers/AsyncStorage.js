/**
 * The AsyncStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */

import _ from 'underscore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @implements {StorageProvider}
 */
class AsyncStorageProvider {
    getAllKeys() {
        return AsyncStorage.getAllKeys();
    }

    getItem(key) {
        return AsyncStorage.getItem(key)
            .then((value) => {
                const parsed = value && JSON.parse(value);
                return parsed;
            });
    }

    multiGet(keys) {
        return AsyncStorage.multiGet(keys)
            .then(pairs => pairs.map(([key, value]) => [key, value && JSON.parse(value)]));
    }

    removeItem(key) {
        return AsyncStorage.removeItem(key);
    }

    setItem(key, value) {
        return AsyncStorage.setItem(key, this.prepareValueForStorage((value)));
    }

    multiSet(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, this.prepareValueForStorage(value)]);
        return AsyncStorage.multiSet(stringPairs);
    }

    multiMerge(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, this.prepareValueForStorage(value)]);
        return AsyncStorage.multiMerge(stringPairs);
    }

    clear() {
        return AsyncStorage.clear();
    }

    /**
     * @private
     * @param {*} value
     * @returns {string|null}
     */
    prepareValueForStorage(value) {
        if (_.isUndefined(value) || _.isNull(value)) {
            return value;
        }

        return JSON.stringify(value);
    }
}

export default AsyncStorageProvider;
