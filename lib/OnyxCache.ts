import {deepEqual} from 'fast-equals';
import bindAll from 'lodash/bindAll';
import type {ValueOf} from 'type-fest';
import utils from './utils';
import type {OnyxKey, OnyxValue} from './types';
import * as Str from './Str';

// Task constants
const TASK = {
    GET: 'get',
    GET_ALL_KEYS: 'getAllKeys',
    CLEAR: 'clear',
} as const;

type CacheTask = ValueOf<typeof TASK> | `${ValueOf<typeof TASK>}:${string}`;

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    /** Cache of all the storage keys available in persistent storage */
    private storageKeys: Set<OnyxKey>;

    /** A list of keys where a nullish value has been fetched from storage before, but the key still exists in cache */
    private nullishStorageKeys: Set<OnyxKey>;

    /** Unique list of keys maintained in access order (most recent at the end) */
    private recentKeys: Set<OnyxKey>;

    /** A map of cached values */
    private storageMap: Record<OnyxKey, OnyxValue<OnyxKey>>;

    /**
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     */
    private pendingPromises: Map<string, Promise<OnyxValue<OnyxKey> | OnyxKey[]>>;

    /** Maximum size of the keys store din cache */
    private maxRecentKeysSize = 0;

    /** List of keys that are safe to remove when we reach max storage */
    private evictionAllowList: OnyxKey[] = [];

    /** Map of keys and connection arrays whose keys will never be automatically evicted */
    private evictionBlocklist: Record<OnyxKey, string[] | undefined> = {};

    /** List of keys that have been directly subscribed to or recently modified from least to most recent */
    private recentlyAccessedKeys: OnyxKey[] = [];

    constructor() {
        this.storageKeys = new Set();
        this.nullishStorageKeys = new Set();
        this.recentKeys = new Set();
        this.storageMap = {};
        this.pendingPromises = new Map();

        // bind all public methods to prevent problems with `this`
        bindAll(
            this,
            'getAllKeys',
            'get',
            'hasCacheForKey',
            'addKey',
            'addNullishStorageKey',
            'hasNullishStorageKey',
            'clearNullishStorageKeys',
            'set',
            'drop',
            'merge',
            'hasPendingTask',
            'getTaskPromise',
            'captureTask',
            'addToAccessedKeys',
            'removeLeastRecentlyUsedKeys',
            'setRecentKeysLimit',
            'setAllKeys',
            'setEvictionAllowList',
            'getEvictionBlocklist',
            'isEvictableKey',
            'removeLastAccessedKey',
            'addLastAccessedKey',
            'addEvictableKeysToRecentlyAccessedList',
            'getKeyForEviction',
        );
    }

    /** Get all the storage keys */
    getAllKeys(): Set<OnyxKey> {
        return this.storageKeys;
    }

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
    setAllKeys(keys: OnyxKey[]) {
        this.storageKeys = new Set(keys);
    }

    /** Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     */
    addKey(key: OnyxKey): void {
        this.storageKeys.add(key);
    }

    /** Used to set keys that are null/undefined in storage without adding null to the storage map */
    addNullishStorageKey(key: OnyxKey): void {
        this.nullishStorageKeys.add(key);
    }

    /** Used to set keys that are null/undefined in storage without adding null to the storage map */
    hasNullishStorageKey(key: OnyxKey): boolean {
        return this.nullishStorageKeys.has(key);
    }

    /** Used to clear keys that are null/undefined in cache */
    clearNullishStorageKeys(): void {
        this.nullishStorageKeys = new Set();
    }

    /** Check whether cache has data for the given key */
    hasCacheForKey(key: OnyxKey): boolean {
        return this.storageMap[key] !== undefined || this.hasNullishStorageKey(key);
    }

    /**
     * Get a cached value from storage
     * @param [shouldReindexCache] – This is an LRU cache, and by default accessing a value will make it become last in line to be evicted. This flag can be used to skip that and just access the value directly without side-effects.
     */
    get(key: OnyxKey, shouldReindexCache = true): OnyxValue<OnyxKey> {
        if (shouldReindexCache) {
            this.addToAccessedKeys(key);
        }
        return this.storageMap[key];
    }

    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): OnyxValue<OnyxKey> {
        this.addKey(key);
        this.addToAccessedKeys(key);

        // When a key is explicitly set in cache, we can remove it from the list of nullish keys,
        // since it will either be set to a non nullish value or removed from the cache completely.
        this.nullishStorageKeys.delete(key);

        if (value === null || value === undefined) {
            delete this.storageMap[key];
            return undefined;
        }

        this.storageMap[key] = value;

        return value;
    }

    /** Forget the cached value for the given key */
    drop(key: OnyxKey): void {
        delete this.storageMap[key];
        this.storageKeys.delete(key);
        this.recentKeys.delete(key);
    }

    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param data - a map of (cache) key - values
     */
    merge(data: Record<OnyxKey, OnyxValue<OnyxKey>>): void {
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
        }

        this.storageMap = {...utils.fastMerge(this.storageMap, data)};

        Object.entries(data).forEach(([key, value]) => {
            this.addKey(key);
            this.addToAccessedKeys(key);

            if (value === null || value === undefined) {
                this.addNullishStorageKey(key);
            } else {
                this.nullishStorageKeys.delete(key);
            }
        });
    }

    /**
     * Check whether the given task is already running
     * @param taskName - unique name given for the task
     */
    hasPendingTask(taskName: CacheTask): boolean {
        return this.pendingPromises.get(taskName) !== undefined;
    }

    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @param taskName - unique name given for the task
     */
    getTaskPromise(taskName: CacheTask): Promise<OnyxValue<OnyxKey> | OnyxKey[]> | undefined {
        return this.pendingPromises.get(taskName);
    }

    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @param taskName - unique name for the task
     */
    captureTask(taskName: CacheTask, promise: Promise<OnyxValue<OnyxKey>>): Promise<OnyxValue<OnyxKey>> {
        const returnPromise = promise.finally(() => {
            this.pendingPromises.delete(taskName);
        });

        this.pendingPromises.set(taskName, returnPromise);

        return returnPromise;
    }

    /** Adds a key to the top of the recently accessed keys */
    addToAccessedKeys(key: OnyxKey): void {
        this.recentKeys.delete(key);
        this.recentKeys.add(key);
    }

    /** Remove keys that don't fall into the range of recently used keys */
    removeLeastRecentlyUsedKeys(): void {
        const numKeysToRemove = this.recentKeys.size - this.maxRecentKeysSize;
        if (numKeysToRemove <= 0) {
            return;
        }

        const iterator = this.recentKeys.values();
        const keysToRemove: OnyxKey[] = [];

        const recentKeysArray = Array.from(this.recentKeys);
        const mostRecentKey = recentKeysArray[recentKeysArray.length - 1];

        let iterResult = iterator.next();
        while (!iterResult.done) {
            const key = iterResult.value;
            // Don't consider the most recently accessed key for eviction
            // This ensures we don't immediately evict a key we just added
            if (key !== undefined && key !== mostRecentKey && this.isEvictableKey(key)) {
                keysToRemove.push(key);
            }
            iterResult = iterator.next();
        }

        for (const key of keysToRemove) {
            delete this.storageMap[key];
            this.recentKeys.delete(key);
        }
    }

    /** Set the recent keys list size */
    setRecentKeysLimit(limit: number): void {
        this.maxRecentKeysSize = limit;
    }

    /** Check if the value has changed */
    hasValueChanged(key: OnyxKey, value: OnyxValue<OnyxKey>): boolean {
        return !deepEqual(this.storageMap[key], value);
    }

    /**
     * Sets the list of keys that are considered safe for eviction
     * @param keys - Array of OnyxKeys that are safe to evict
     */
    setEvictionAllowList(keys: OnyxKey[]): void {
        this.evictionAllowList = keys;
    }

    /**
     * Get the eviction block list that prevents keys from being evicted
     */
    getEvictionBlocklist(): Record<OnyxKey, string[] | undefined> {
        return this.evictionBlocklist;
    }

    /**
     * Checks to see if this key has been flagged as safe for removal.
     * @param testKey - Key to check
     */
    isEvictableKey(testKey: OnyxKey): boolean {
        return this.evictionAllowList.some((key) => this.isKeyMatch(key, testKey));
    }

    /**
     * Check if a given key matches a pattern key
     * @param configKey - Pattern that may contain a wildcard
     * @param key - Key to test against the pattern
     */
    private isKeyMatch(configKey: OnyxKey, key: OnyxKey): boolean {
        const isCollectionKey = configKey.endsWith('_');
        return isCollectionKey ? Str.startsWith(key, configKey) : configKey === key;
    }

    /**
     * Remove a key from the recently accessed key list.
     */
    removeLastAccessedKey(key: OnyxKey): void {
        this.recentlyAccessedKeys = this.recentlyAccessedKeys.filter((recentlyAccessedKey) => recentlyAccessedKey !== key);
    }

    /**
     * Add a key to the list of recently accessed keys. The least
     * recently accessed key should be at the head and the most
     * recently accessed key at the tail.
     */
    addLastAccessedKey(key: OnyxKey, isCollectionKey: boolean): void {
        // Only specific keys belong in this list since we cannot remove an entire collection.
        if (isCollectionKey || !this.isEvictableKey(key)) {
            return;
        }

        this.removeLastAccessedKey(key);
        this.recentlyAccessedKeys.push(key);
    }

    /**
     * Take all the keys that are safe to evict and add them to
     * the recently accessed list when initializing the app. This
     * enables keys that have not recently been accessed to be
     * removed.
     * @param isCollectionKeyFn - Function to determine if a key is a collection key
     * @param getAllKeysFn - Function to get all keys, defaults to Storage.getAllKeys
     */
    addEvictableKeysToRecentlyAccessedList(isCollectionKeyFn: (key: OnyxKey) => boolean, getAllKeysFn: () => Promise<Set<OnyxKey>>): Promise<void> {
        return getAllKeysFn().then((keys: Set<OnyxKey>) => {
            this.evictionAllowList.forEach((evictableKey) => {
                keys.forEach((key: OnyxKey) => {
                    if (!this.isKeyMatch(evictableKey, key)) {
                        return;
                    }

                    this.addLastAccessedKey(key, isCollectionKeyFn(key));
                });
            });
        });
    }

    /**
     * Finds a key that can be safely evicted
     */
    getKeyForEviction(): OnyxKey | undefined {
        return this.recentlyAccessedKeys.find((key) => !this.evictionBlocklist[key]);
    }
}

const instance = new OnyxCache();

export default instance;
export {TASK};
export type {CacheTask};
