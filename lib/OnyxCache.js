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
            'getAllKeys', 'getValue', 'hasCacheForKey', 'addKey', 'set', 'remove', 'merge', 'resolveTask',
        );
    }

    /**
     * Get all the storage keys
     * @returns {string[]}
     */
    getAllKeys() {
        return [...this.storageKeys];
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
     * Adds the keys to the storage keys list as well
     * Providing value is optional. Skipping value would just capture the key so that
     * it's available in `getAllKeys`
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
     * Deep merge data to cache, any non existing keys will be crated
     * @param {Record<string, *>} data - a map of (cache) key - values
     */
    merge(data) {
        this.storageMap = lodashMerge({}, this.storageMap, data);
    }

    /**
     * Use this method to prevents additional calls from the same thing
     * When a promise for a given call already exists the caller would
     * be hooked to it. Otherwise the task is started and captured so
     * that other callers don't have to start over
     * Particularly useful for data retrieving methods
     * @template T
     * @param {string} taskName
     * @param {function(): Promise<T>} startTask - Provide a promise returning function that
     * will be invoked if there is no pending promise for this task
     * @returns {Promise<T>}
     */
    resolveTask(taskName, startTask) {
        // When a task is already running return it right away
        if (isDefined(this.pendingPromises[taskName])) {
            return this.pendingPromises[taskName];
        }

        // Otherwise start the task and store a reference
        this.pendingPromises[taskName] = startTask()
            .finally(() => {
                // Cleanup after the task is over
                delete this.pendingPromises[taskName];
            });

        return this.pendingPromises[taskName];
    }
}

const instance = new OnyxCache();

export default instance;
