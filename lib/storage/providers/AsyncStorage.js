/**
 * The AsyncStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @implements {StorageProvider}
 */
class AsyncStorageProvider {
    async getAllKeys() {
        return AsyncStorage.getAllKeys();
    }

    async getItem(key) {
        return AsyncStorage.getItem(key)
            .then((value) => {
                const parsed = value && JSON.parse(value);
                return parsed;
            });
    }

    async multiGet(keys) {
        return AsyncStorage.multiGet(keys)
            .then(pairs => pairs.map(([key, value]) => [key, value && JSON.parse(value)]));
    }

    async removeItem(key) {
        return AsyncStorage.removeItem(key);
    }

    async setItem(key, value) {
        return AsyncStorage.setItem(key, value && JSON.stringify(value));
    }

    async multiSet(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, value && JSON.stringify(value)]);
        return AsyncStorage.multiSet(stringPairs);
    }

    async multiMerge(pairs) {
        const stringPairs = pairs.map(([key, value]) => [key, value && JSON.stringify(value)]);
        return AsyncStorage.multiMerge(stringPairs);
    }

    async clear() {
        return AsyncStorage.clear();
    }
}

export default AsyncStorageProvider;
