import type { OnyxKey, OnyxValue } from './types';
/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
declare class OnyxCache {
    /** Cache of all the storage keys available in persistent storage */
    private storageKeys;
    /** A list of keys where a nullish value has been fetched from storage before, but the key still exists in cache */
    private nullishStorageKeys;
    /** Unique list of keys maintained in access order (most recent at the end) */
    private recentKeys;
    /** A map of cached values */
    private storageMap;
    /**
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     */
    private pendingPromises;
    /** Maximum size of the keys store din cache */
    private maxRecentKeysSize;
    constructor();
    /** Get all the storage keys */
    getAllKeys(): Set<OnyxKey>;
    /**
     * Allows to set all the keys at once.
     * This is useful when we are getting
     * all the keys from the storage provider
     * and we want to keep the cache in sync.
     *
     * Previously, we had to call `addKey` in a loop
     * to achieve the same result.
     *
     * @param keys - an array of keys
     */
    setAllKeys(keys: OnyxKey[]): void;
    /** Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     */
    addKey(key: OnyxKey): void;
    /** Used to set keys that are null/undefined in storage without adding null to the storage map */
    addNullishStorageKey(key: OnyxKey): void;
    /** Used to set keys that are null/undefined in storage without adding null to the storage map */
    hasNullishStorageKey(key: OnyxKey): boolean;
    /** Used to clear keys that are null/undefined in cache */
    clearNullishStorageKeys(): void;
    /** Check whether cache has data for the given key */
    hasCacheForKey(key: OnyxKey): boolean;
    /**
     * Get a cached value from storage
     * @param [shouldReindexCache] – This is an LRU cache, and by default accessing a value will make it become last in line to be evicted. This flag can be used to skip that and just access the value directly without side-effects.
     */
    get(key: OnyxKey, shouldReindexCache?: boolean): OnyxValue<OnyxKey>;
    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): OnyxValue<OnyxKey>;
    /** Forget the cached value for the given key */
    drop(key: OnyxKey): void;
    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param data - a map of (cache) key - values
     */
    merge(data: Record<OnyxKey, OnyxValue<OnyxKey>>): void;
    /**
     * Check whether the given task is already running
     * @param taskName - unique name given for the task
     */
    hasPendingTask(taskName: string): boolean;
    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @param taskName - unique name given for the task
     */
    getTaskPromise(taskName: string): Promise<OnyxValue<OnyxKey> | OnyxKey[]> | undefined;
    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @param taskName - unique name for the task
     */
    captureTask(taskName: string, promise: Promise<OnyxValue<OnyxKey>>): Promise<OnyxValue<OnyxKey>>;
    /** Adds a key to the top of the recently accessed keys */
    addToAccessedKeys(key: OnyxKey): void;
    /** Remove keys that don't fall into the range of recently used keys */
    removeLeastRecentlyUsedKeys(): void;
    /** Set the recent keys list size */
    setRecentKeysLimit(limit: number): void;
    /** Check if the value has changed */
    hasValueChanged(key: OnyxKey, value: OnyxValue<OnyxKey>): boolean;
}
declare const instance: OnyxCache;
export default instance;
