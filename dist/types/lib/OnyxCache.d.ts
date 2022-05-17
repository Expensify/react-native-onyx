export default instance;
declare const instance: OnyxCache;
/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
declare class OnyxCache {
    /**
     * @private
     * Cache of all the storage keys available in persistent storage
     * @type {Set<string>}
     */
    private storageKeys;
    /**
     * @private
     * Unique list of keys maintained in access order (most recent at the end)
     * @type {Set<string>}
     */
    private recentKeys;
    /**
     * @private
     * A map of cached values
     * @type {Record<string, *>}
     */
    private storageMap;
    /**
     * @private
     * Captured pending tasks for already running storage methods
     * @type {Record<string, Promise>}
     */
    private pendingPromises;
    /**
     * Get all the storage keys
     * @returns {string[]}
     */
    getAllKeys(): string[];
    /**
     * Get a cached value from storage
     * @param {string} key
     * @returns {*}
     */
    getValue(key: string): any;
    /**
     * Check whether cache has data for the given key
     * @param {string} key
     * @returns {boolean}
     */
    hasCacheForKey(key: string): boolean;
    /**
     * Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     * @param {string} key
     */
    addKey(key: string): void;
    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     * @param {string} key
     * @param {*} value
     * @returns {*} value - returns the cache value
     */
    set(key: string, value: any): any;
    /**
     * Forget the cached value for the given key
     * @param {string} key
     */
    drop(key: string): void;
    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param {Record<string, *>} data - a map of (cache) key - values
     */
    merge(data: Record<string, any>): void;
    /**
     * Check whether the given task is already running
     * @param {string} taskName - unique name given for the task
     * @returns {*}
     */
    hasPendingTask(taskName: string): any;
    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @template T
     * @param {string} taskName - unique name given for the task
     * @returns {Promise<T>}
     */
    getTaskPromise<T>(taskName: string): Promise<T>;
    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @template T
     * @param {string} taskName - unique name for the task
     * @param {Promise<T>} promise
     * @returns {Promise<T>}
     */
    captureTask<T_1>(taskName: string, promise: Promise<T_1>): Promise<T_1>;
    /**
     * @private
     * Adds a key to the top of the recently accessed keys
     * @param {string} key
     */
    private addToAccessedKeys;
    /**
     * Remove keys that don't fall into the range of recently used keys
     */
    removeLeastRecentlyUsedKeys(): void;
    /**
     * Set the recent keys list size
     * @param {number} limit
     */
    setRecentKeysLimit(limit: number): void;
    maxRecentKeysSize: number;
}
//# sourceMappingURL=OnyxCache.d.ts.map