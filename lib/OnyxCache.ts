import {deepEqual} from 'fast-equals';
import bindAll from 'lodash/bindAll';
import type {ValueOf} from 'type-fest';
import utils from './utils';
import type {OnyxKey, OnyxValue} from './types';
import OnyxKeys from './OnyxKeys';

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

    /** A map of cached values */
    private storageMap: Record<OnyxKey, OnyxValue<OnyxKey>>;

    /** Cache of complete collection data objects for O(1) retrieval */
    private collectionData: Record<OnyxKey, Record<OnyxKey, OnyxValue<OnyxKey>>>;

    /**
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     */
    private pendingPromises: Map<string, Promise<OnyxValue<OnyxKey> | OnyxKey[]>>;

    /** List of keys that are safe to remove when we reach max storage */
    private evictionAllowList: OnyxKey[] = [];

    /** List of keys that have been directly subscribed to or recently modified from least to most recent */
    private recentlyAccessedKeys = new Set<OnyxKey>();

    constructor() {
        this.storageKeys = new Set();
        this.nullishStorageKeys = new Set();
        this.storageMap = {};
        this.collectionData = {};
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
            'setAllKeys',
            'setEvictionAllowList',
            'isEvictableKey',
            'removeLastAccessedKey',
            'addLastAccessedKey',
            'addEvictableKeysToRecentlyAccessedList',
            'getKeyForEviction',
            'setCollectionKeys',
            'getCollectionData',
            'hasValueChanged',
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
        for (const key of keys) {
            OnyxKeys.registerMemberKey(key);
        }
    }

    /** Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     */
    addKey(key: OnyxKey): void {
        this.storageKeys.add(key);
        OnyxKeys.registerMemberKey(key);
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

    /** Get a cached value from storage */
    get(key: OnyxKey): OnyxValue<OnyxKey> {
        return this.storageMap[key];
    }

    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): OnyxValue<OnyxKey> {
        this.addKey(key);

        // When a key is explicitly set in cache, we can remove it from the list of nullish keys,
        // since it will either be set to a non nullish value or removed from the cache completely.
        this.nullishStorageKeys.delete(key);

        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (value === null || value === undefined) {
            delete this.storageMap[key];

            // Remove from collection data cache if it's a collection member
            if (collectionKey && this.collectionData[collectionKey]) {
                delete this.collectionData[collectionKey][key];
            }
            return undefined;
        }

        this.storageMap[key] = value;

        // Update collection data cache if this is a collection member
        if (collectionKey) {
            if (!this.collectionData[collectionKey]) {
                this.collectionData[collectionKey] = {};
            }
            this.collectionData[collectionKey][key] = value;
        }

        return value;
    }

    /** Forget the cached value for the given key */
    drop(key: OnyxKey): void {
        delete this.storageMap[key];

        // Remove from collection data cache if this is a collection member
        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey && this.collectionData[collectionKey]) {
            delete this.collectionData[collectionKey][key];
        }

        // If this is a collection key, clear its data
        if (OnyxKeys.isCollectionKey(key)) {
            delete this.collectionData[key];
        }

        this.storageKeys.delete(key);
        OnyxKeys.deregisterMemberKey(key);
    }

    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param data - a map of (cache) key - values
     */
    merge(data: Record<OnyxKey, OnyxValue<OnyxKey>>): void {
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
        }

        this.storageMap = {
            ...utils.fastMerge(this.storageMap, data, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            }).result,
        };

        for (const [key, value] of Object.entries(data)) {
            this.addKey(key);

            const collectionKey = OnyxKeys.getCollectionKey(key);

            if (value === null || value === undefined) {
                this.addNullishStorageKey(key);

                // Remove from collection data cache if it's a collection member
                if (collectionKey && this.collectionData[collectionKey]) {
                    delete this.collectionData[collectionKey][key];
                }
            } else {
                this.nullishStorageKeys.delete(key);

                // Update collection data cache if this is a collection member
                if (collectionKey) {
                    if (!this.collectionData[collectionKey]) {
                        this.collectionData[collectionKey] = {};
                    }
                    this.collectionData[collectionKey][key] = this.storageMap[key];
                }
            }
        }
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

    /** Check if the value has changed */
    hasValueChanged(key: OnyxKey, value: OnyxValue<OnyxKey>): boolean {
        const currentValue = this.get(key);
        return !deepEqual(currentValue, value);
    }

    /**
     * Sets the list of keys that are considered safe for eviction
     * @param keys - Array of OnyxKeys that are safe to evict
     */
    setEvictionAllowList(keys: OnyxKey[]): void {
        this.evictionAllowList = keys;
    }

    /**
     * Checks to see if this key has been flagged as safe for removal.
     * @param testKey - Key to check
     */
    isEvictableKey(testKey: OnyxKey): boolean {
        return this.evictionAllowList.some((key) => OnyxKeys.isKeyMatch(key, testKey));
    }

    /**
     * Remove a key from the recently accessed key list.
     */
    removeLastAccessedKey(key: OnyxKey): void {
        this.recentlyAccessedKeys.delete(key);
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
        this.recentlyAccessedKeys.add(key);
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
            for (const evictableKey of this.evictionAllowList) {
                for (const key of keys) {
                    if (!OnyxKeys.isKeyMatch(evictableKey, key)) {
                        continue;
                    }

                    this.addLastAccessedKey(key, isCollectionKeyFn(key));
                }
            }
        });
    }

    /**
     * Finds the least recently accessed key that can be safely evicted from storage.
     */
    getKeyForEviction(): OnyxKey | undefined {
        // recentlyAccessedKeys is ordered from least to most recently accessed,
        // so the first element is the best candidate for eviction.
        return this.recentlyAccessedKeys.values().next().value;
    }

    /**
     * Set the collection keys for optimized storage
     */
    setCollectionKeys(collectionKeys: Set<OnyxKey>): void {
        OnyxKeys.setCollectionKeys(collectionKeys);

        // Initialize collection data for existing collection keys
        for (const collectionKey of collectionKeys) {
            if (this.collectionData[collectionKey]) {
                continue;
            }
            this.collectionData[collectionKey] = {};
        }
    }

    /**
     * Get all data for a collection key
     */
    getCollectionData(collectionKey: OnyxKey): Record<OnyxKey, OnyxValue<OnyxKey>> | undefined {
        const cachedCollection = this.collectionData[collectionKey];
        if (!cachedCollection || Object.keys(cachedCollection).length === 0) {
            return undefined;
        }

        // Return a shallow copy to ensure React detects changes when items are added/removed
        return {...cachedCollection};
    }
}

const instance = new OnyxCache();

export default instance;
export {TASK};
export type {CacheTask};
