import _ from 'underscore';
import lodashMerge from 'lodash/merge';


const isDefined = _.negate(_.isUndefined);

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    constructor() {
        /**
         * @private
         * Cache of all the storage keys available in persistent storage
         * @type {Set<string>}
         */
        this.storageKeys = new Set();

        /**
         * @private
         * A map of cached values
         * @type {Record<string, *>}
         */
        this.storageMap = {};

        /**
         * @private
         * Captured pending tasks for already running storage methods
         * @type {Record<string, Promise>}
         */
        this.pendingPromises = {};

        // bind all methods to prevent problems with `this`
        _.bindAll(
            this,
            'getAllKeys', 'getValue', 'hasCacheForKey', 'addKey', 'set', 'remove', 'merge',
            'hasPendingTask', 'getTaskPromise', 'captureTask',
        );
    }

    /**
     * Get all the storage keys
     * @returns {string[]}
     */
    getAllKeys() {
        return Array.from(this.storageKeys);
    }

    /**
     * Get a cached value from storage
     * @param {string} key
     * @returns {*}
     */
    getValue(key) {
        return this.storageMap[key];
    }

    /**
     * Check whether cache has data for the given key
     * @param {string} key
     * @returns {boolean}
     */
    hasCacheForKey(key) {
        return isDefined(this.storageMap[key]);
    }

    /**
     * Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     * @param {string} key
     */
    addKey(key) {
        this.storageKeys.add(key);
    }

    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     * @param {string} key
     * @param {*} value
     * @returns {*} value - returns the cache value
     */
    set(key, value) {
        this.addKey(key);
        this.storageMap[key] = value;

        return value;
    }

    /**
     * Remove data from cache
     * @param {string} key
     */
    remove(key) {
        this.storageKeys.delete(key);
        delete this.storageMap[key];
    }

    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param {Record<string, *>} data - a map of (cache) key - values
     */
    merge(data) {
        this.storageMap = lodashMerge({}, this.storageMap, data);

        const storageKeys = this.getAllKeys();
        const mergedKeys = _.keys(data);
        this.storageKeys = new Set([...storageKeys, ...mergedKeys]);
    }

    /**
     * Check whether the given task is already running
     * @param {string} taskName - unique name given for the task
     * @returns {*}
     */
    hasPendingTask(taskName) {
        return isDefined(this.pendingPromises[taskName]);
    }

    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @template T
     * @param {string} taskName - unique name given for the task
     * @returns {Promise<T>}
     */
    getTaskPromise(taskName) {
        return this.pendingPromises[taskName];
    }

    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @template T
     * @param {string} taskName - unique name for the task
     * @param {Promise<T>} promise
     * @returns {Promise<T>}
     */
    captureTask(taskName, promise) {
        this.pendingPromises[taskName] = promise.finally(() => {
            delete this.pendingPromises[taskName];
        });

        return this.pendingPromises[taskName];
    }
}

const instance = new OnyxCache();

export default instance;
