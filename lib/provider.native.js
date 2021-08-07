import {MMKV} from 'react-native-mmkv';
import _ from 'underscore';
import lodashMerge from 'lodash/merge';

/**
 * @implements {ProviderInterface}
 */
class MMKV_Provider {
    async clear() {
        MMKV.clearAll();
        return Promise.resolve();
    }

    async getAllKeys() {
        const keys = MMKV.getAllKeys();
        return Promise.resolve(keys);
    }

    async getItem(key) {
        const value = MMKV.getString(key);
        return Promise.resolve(value);
    }

    async multiGet(keys) {
        const pairs = keys.map(key => [key, MMKV.getString(key)]);
        return Promise.resolve(pairs);
    }

    async multiMerge(pairs) {
        pairs.forEach(([key, delta]) => {
            let merged = JSON.parse(delta);
            const existing = MMKV.getString(key);
            if (existing) {
                const parsed = JSON.parse(existing);
                if (_.isObject(parsed)) {
                    merged = lodashMerge(parsed, delta);
                }
            }

            const asString = JSON.stringify(merged);
            MMKV.set(key, asString);
        });

        return Promise.resolve();
    }

    async multiSet(pairs) {
        pairs.forEach(([key, value]) => MMKV.set(key, value));
        return Promise.resolve();
    }

    async removeItem(key) {
        MMKV.delete(key);
        return Promise.resolve();
    }

    async setItem(key, value) {
        MMKV.set(key, value);
        return Promise.resolve();
    }
}

const instance = new MMKV_Provider();

export default instance;
