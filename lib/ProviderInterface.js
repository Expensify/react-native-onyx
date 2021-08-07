function notImplemented() {
    throw new Error('Method not implemented');
}

/**
 * @interface
 */
class ProviderInterface {
    /**
     * @returns {Promise<string[]>}
     */
    async getAllKeys() {
        return notImplemented();
    }

    /**
     * @template T
     * @param {string} key
     * @returns {Promise<T>}
     */
    async getItem(key) {
        return notImplemented(key);
    }

    /**
     * @template T
     * @param {string[]} keys
     * @returns {Promise<T[]>}
     */
    async multiGet(keys) {
        return notImplemented(keys);
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        notImplemented(key);
    }

    /**
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        notImplemented(key, value);
    }

    /**
     * @param {Array<[string, *]>} pairs
     * @returns {Promise<void>}
     */
    async multiSet(pairs) {
        notImplemented(pairs);
    }

    /**
     * @param {Array<[string, *]>} pairs
     * @returns {Promise<void>}
     */
    async multiMerge(pairs) {
        notImplemented(pairs);
    }

    /**
     * @returns {Promise<void>}
     */
    async clear() {
        notImplemented();
    }
}

export default ProviderInterface;
