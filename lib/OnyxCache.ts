import {deepEqual} from 'fast-equals';
import bindAll from 'lodash/bindAll';
import type {ValueOf} from 'type-fest';
import utils from './utils';
import type {OnyxKey, OnyxValue} from './types';

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

    /** Maximum size of the keys stored in cache (legacy property for backward compatibility) */
    private maxRecentKeysSize = 0;

    /** Memory usage limit in bytes (default: 50MB) */
    private memoryUsageLimit = 10 * 1024 * 1024;

    /** Current estimated memory usage in bytes */
    private currentMemoryUsage = 0;

    /** Memory threshold percentage that triggers cleanup (default: 85%) */
    private memoryThreshold = 0.85;

    /** Minimum key size to track for memory estimation (bytes) */
    private minKeySize = 100;

    /** Map of key timestamps */
    // private keyTimestamps = new Map<OnyxKey, number>();

    /** Set of keys that should not be evicted */
    private nonEvictableKeys = new Set<OnyxKey>();

    /** Count of expired keys cleaned since last reset */
    private expiredKeysCleanedCount = 0;

    /** Timestamp of last key expiration cleanup */
    private lastExpirationCleanupTime = 0;

    /** Expiration time in milliseconds */
    private readonly EXPIRATION_TIME_MS = 10 * 60 * 60 * 1000;

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
            'removeLeastRecentlyUsedKeys',
            'setRecentKeysLimit',
            'setAllKeys',
            'markKeyAsNonEvictable',
            'markKeyAsEvictable',
            'isKeyEvictable',
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
        // this.cleanExpiredKeys(); //
        this.addKey(key);
        this.addToAccessedKeys(key);

        // When a key is explicitly set in cache, we can remove it from the list of nullish keys,
        // since it will either be set to a non nullish value or removed from the cache completely.
        this.nullishStorageKeys.delete(key);

        if (value === null || value === undefined) {
            // Track memory usage reduction
            if (this.storageMap[key] !== undefined) {
                this.reduceMemoryUsage(key, this.storageMap[key]);
            }
            delete this.storageMap[key];
            return undefined;
        }

        // Track memory usage
        this.trackMemoryUsage(key, value);

        // Check if we need to free up memory
        if (this.shouldReduceMemoryUsage()) {
            this.freeMemory();
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
        // this.keyTimestamps.set(key, Date.now());
    }

    /**
     * Tracks memory usage for a key-value pair
     */
    trackMemoryUsage(key: OnyxKey, value: OnyxValue<OnyxKey>): void {
        // If this key already exists, first reduce its current memory usage
        if (this.storageMap[key] !== undefined) {
            this.reduceMemoryUsage(key, this.storageMap[key]);
        }

        // Calculate approximate size of the value
        let valueSize = 0;

        try {
            // Using JSON.stringify for a rough estimate
            const valueStr = JSON.stringify(value);
            valueSize = valueStr.length * 2; // UTF-16 encoding uses 2 bytes per character
        } catch (e) {
            // Fallback to minimum size if stringification fails
            valueSize = this.minKeySize;
        }

        // Update memory usage
        this.currentMemoryUsage += valueSize;
    }

    /**
     * Reduces tracked memory usage when a key is removed or updated
     */
    reduceMemoryUsage(key: OnyxKey, value: OnyxValue<OnyxKey>): void {
        let valueSize = 0;

        try {
            // Using JSON.stringify for a rough estimate
            const valueStr = JSON.stringify(value);
            valueSize = valueStr.length * 2; // UTF-16 encoding uses 2 bytes per character
        } catch (e) {
            // Fallback to minimum size if stringification fails
            valueSize = this.minKeySize;
        }

        this.currentMemoryUsage = Math.max(0, this.currentMemoryUsage - valueSize);
    }

    /**
     * Checks if memory usage has exceeded the threshold
     */
    shouldReduceMemoryUsage(): boolean {
        return this.currentMemoryUsage > this.memoryUsageLimit * this.memoryThreshold;
    }

    /**
     * Frees memory by removing least recently used keys that are safe to evict
     */
    freeMemory(): void {
        const targetMemoryUsage = this.memoryUsageLimit * 0.7; // Target 70% usage after cleanup
        const keysToRemove: OnyxKey[] = [];

        // If we're under the limit, no need to free memory
        if (this.currentMemoryUsage <= targetMemoryUsage) {
            return;
        }

        // Build list of keys to remove (least recently used first)
        const orderedKeys = Array.from(this.recentKeys);

        // Use array iteration instead of for...of loop
        orderedKeys.some((key) => {
            if (this.currentMemoryUsage <= targetMemoryUsage) {
                return true; // Stop iteration once we're under the target
            }

            if (this.isKeyEvictable(key)) {
                keysToRemove.push(key);
                this.reduceMemoryUsage(key, this.storageMap[key]);
            }
            return false;
        });

        // Remove the keys from cache
        keysToRemove.forEach((key) => {
            delete this.storageMap[key];
            this.recentKeys.delete(key);
        });
    }

    // cleanExpiredKeys(): void {
    //     const now = Date.now();
    //     const expiredKeys: OnyxKey[] = [];

    //     this.keyTimestamps.forEach((timestamp, key) => {
    //         // Skip keys that are not safe for eviction
    //         // if (!OnyxUtils.isSafeEvictionKey(key)) return;
    //         if (now - timestamp < this.EXPIRATION_TIME_MS) {
    //             return;
    //         }

    //         expiredKeys.push(key);
    //     });

    //     // Remove expired keys
    //     expiredKeys.forEach((key) => {
    //         this.storageMap[key] = undefined;
    //         this.recentKeys.delete(key);
    //         this.keyTimestamps.delete(key);
    //     });

    //     if (expiredKeys.length > 0) {
    //         this.expiredKeysCleanedCount += expiredKeys.length;
    //         this.lastExpirationCleanupTime = now;
    //         Logger.logInfo(`Cleaned ${expiredKeys.length} expired keys from cache`);
    //     }
    // }

    /**
     * Marks a key as non-evictable, meaning it won't be automatically evicted
     * when the cache size limit is reached
     */
    markKeyAsNonEvictable(key: OnyxKey): void {
        this.nonEvictableKeys.add(key);
    }

    /**
     * Marks a key as evictable, allowing it to be automatically evicted
     * when the cache size limit is reached
     */
    markKeyAsEvictable(key: OnyxKey): void {
        this.nonEvictableKeys.delete(key);
    }

    /**
     * Checks if a key can be evicted
     */
    isKeyEvictable(key: OnyxKey): boolean {
        return !this.nonEvictableKeys.has(key);
    }

    /** Remove keys that don't fall into the range of recently used keys */
    removeLeastRecentlyUsedKeys(): void {
        // For backward compatibility with code that may still call this method
        this.freeMemory();
    }

    /** Set the recent keys list size */
    setRecentKeysLimit(limit: number): void {
        // For backward compatibility with code that may still call this method
        this.maxRecentKeysSize = limit;

        // Adjust memory limit based on the key limit (rough heuristic)
        // This ensures systems that call setRecentKeysLimit still have some control over cache size
        this.memoryUsageLimit = Math.max(this.memoryUsageLimit, limit * this.minKeySize * 10);
    }

    /**
     * Sets the memory usage limit in megabytes
     */
    setMemoryLimit(limitInMB: number): void {
        this.memoryUsageLimit = limitInMB * 1024 * 1024;

        // If we're already over the new limit, trigger cleanup
        if (this.shouldReduceMemoryUsage()) {
            this.freeMemory();
        }
    }

    /**
     * Gets the current memory usage in megabytes
     */
    getMemoryUsage(): number {
        return this.currentMemoryUsage / (1024 * 1024);
    }

    /**
     * Gets the memory usage limit in megabytes
     */
    getMemoryLimit(): number {
        return this.memoryUsageLimit / (1024 * 1024);
    }

    /** Check if the value has changed */
    hasValueChanged(key: OnyxKey, value: OnyxValue<OnyxKey>): boolean {
        return !deepEqual(this.storageMap[key], value);
    }

    getRecentlyUsedKeys(count = 20): OnyxKey[] {
        const keys = Array.from(this.recentKeys).slice(-count);
        return keys.reverse(); // Most recent first
    }

    /**
     * Gets the number of expired keys cleaned since last reset
     */
    getExpiredKeysCleanedCount(): number {
        return this.expiredKeysCleanedCount;
    }

    /**
     * Gets the timestamp of the last key expiration cleanup
     */
    getLastExpirationCleanupTime(): number {
        return this.lastExpirationCleanupTime;
    }

    /**
     * Gets the expiration time in milliseconds
     */
    getExpirationTimeMs(): number {
        return this.EXPIRATION_TIME_MS;
    }

    /**
     * Resets the expired keys cleaned count
     */
    resetExpiredKeysCleanedCount(): void {
        this.expiredKeysCleanedCount = 0;
    }
}

const instance = new OnyxCache();

export default instance;
export {TASK};
export type {CacheTask};
