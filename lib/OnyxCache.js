import _ from 'underscore';

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
            'getAllKeys', 'getValue', 'hasCacheForKey', 'update', 'remove', 'merge', 'resolveTask',
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
     * Update or add data to cache
     * Providing value is optional. Skipping value would just capture the key so that
     * it's available in `getAllKeys`
     * @param {string} key
     * @param {*} [value]
     */
    update(key, value) {
        // Keep storage keys up to date so that `getAllKeys` works correctly
        this.storageKeys.add(key);

        // When a 2nd parameter (value) is provided - store it under the key
        if (isDefined(value)) {
            this.storageMap[key] = value;
        }
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
     * Merge data to cache, any non existing keys will be crated
     * Array items are concatenated
     * Object items are merged
     * If the existing value in cache and the new value are not the same type
     * the existing value is replaced by the new value
     * In case the merge value for a key is undefined - the key is removed from cache
     * @param {Array<[string, *]>} pairs - array of key value pairs
     */
    merge(pairs) {
        _.forEach(pairs, ([key, valueToMerge]) => {
            if (_.isUndefined(valueToMerge)) {
                this.remove(key);
                return;
            }

            const existingValue = this.storageMap[key];
            let newValue = valueToMerge;

            /* Perform merge or concatenation for complex values otherwise just replace the old value */

            if (_.isObject(valueToMerge) && _.isObject(existingValue)) {
                newValue = {...existingValue, ...valueToMerge};
            }

            if (_.isArray(valueToMerge) && _.isArray(existingValue)) {
                newValue = [...existingValue, ...valueToMerge];
            }

            this.update(key, newValue);
        });
    }

    /**
     * Use this method to prevents additional calls from the same thing
     * When a promise for a given call already exists the caller would
     * be hooked to it. Otherwise the task is started and captured so
     * that other callers don't have to start over
     * Particularly useful for data retrieving methods
     * @param {string} taskName
     * @param {function(): Promise} startTask - Provide a promise returning function that
     * will be invoked if there is no pending promise for this task
     * @returns {Promise}
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
