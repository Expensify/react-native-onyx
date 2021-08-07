import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @implements {ProviderInterface}
 */
class AsyncStorageProvider {
    async getAllKeys() {
        return AsyncStorage.getAllKeys();
    }

    async getItem(key) {
        return AsyncStorage.getItem(key);
    }

    async multiGet(keys) {
        return AsyncStorage.multiGet(keys);
    }

    async removeItem(key) {
        return AsyncStorage.removeItem(key);
    }

    async setItem(key, value) {
        return AsyncStorage.setItem(key, value);
    }

    async multiSet(pairs) {
        return AsyncStorage.multiSet(pairs);
    }

    async multiMerge(pairs) {
        return AsyncStorage.multiMerge(pairs);
    }

    async clear() {
        return AsyncStorage.clear();
    }
}

export default AsyncStorageProvider;
