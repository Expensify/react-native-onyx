import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';
import type {UseOnyxOptions, UseOnyxResult, UseOnyxSelector} from './useOnyx';

/**
 * Manages snapshot caching for useOnyx hook performance optimization.
 * Handles selector function tracking and memoized getSnapshot results.
 */
class OnyxSnapshotCache {
    /**
     * Snapshot cache is a two-level map. The top-level keys are Onyx keys. The top-level values maps.
     * The second-level keys are a custom composite string defined by this.registerConsumer. These represent a unique useOnyx config, which is not fully represented by the Onyx key alone.
     * The reason we have two levels is for performance: not to make cache access faster, but to make cache invalidation faster.
     * We can invalidate the snapshot cache for a given Onyx key with one map.delete operation on the top-level map, rather than having to loop through a large single-level map and delete any matching keys.
     */
    private snapshotCache: Map<OnyxKey, Map<string, UseOnyxResult<OnyxValue<OnyxKey>>>>;

    /**
     * Maps selector functions to unique IDs for cache key generation
     */
    private selectorIDMap: WeakMap<UseOnyxSelector<OnyxKey, unknown>, number>;

    /**
     * Counter for generating incremental selector IDs
     */
    private selectorIDCounter: number;

    /**
     * Reference counting for cache keys to enable automatic cleanup.
     * Maps cache key (string) to number of consumers using it.
     */
    private cacheKeyRefCounts: Map<string, number>;

    constructor() {
        this.snapshotCache = new Map();
        this.selectorIDMap = new Map();
        this.selectorIDCounter = 0;
        this.cacheKeyRefCounts = new Map();
    }

    /**
     * Generate unique ID for selector functions using incrementing numbers
     */
    getSelectorID<TKey extends OnyxKey, TReturnValue>(selector: UseOnyxSelector<TKey, TReturnValue>): number {
        const typedSelector = selector as unknown as UseOnyxSelector<OnyxKey, unknown>;
        if (!this.selectorIDMap.has(typedSelector)) {
            const id = this.selectorIDCounter++;
            this.selectorIDMap.set(typedSelector, id);
        }
        return this.selectorIDMap.get(typedSelector)!;
    }

    /**
     * Register a consumer for a cache key and return the cache key.
     * Generates cache key and increments reference counter.
     *
     * The properties used to generate the cache key are handpicked for performance reasons and
     * according to their purpose and effect they produce in the useOnyx hook behavior:
     *
     * - `selector`: Different selectors produce different results, so each selector needs its own cache entry
     * - `initWithStoredValues`: This flag changes the initial loading behavior and affects the returned fetch status
     * - `allowStaleData`: Controls whether stale data can be returned during pending merges, affecting result timing
     *
     * Other options like `canEvict`, `reuseConnection`, and `allowDynamicKey` don't affect the data transformation
     * or timing behavior of getSnapshot, so they're excluded from the cache key for better cache hit rates.
     */
    registerConsumer<TKey extends OnyxKey, TReturnValue>(options: Pick<UseOnyxOptions<TKey, TReturnValue>, 'selector' | 'initWithStoredValues' | 'allowStaleData'>): string {
        const selectorID = options?.selector ? this.getSelectorID(options.selector) : 'no_selector';

        // Create options hash without expensive JSON.stringify
        const initWithStoredValues = options?.initWithStoredValues ?? true;
        const allowStaleData = options?.allowStaleData ?? false;
        const cacheKey = `${selectorID}_${initWithStoredValues}_${allowStaleData}`;

        // Increment reference count for this cache key
        const currentCount = this.cacheKeyRefCounts.get(cacheKey) || 0;
        this.cacheKeyRefCounts.set(cacheKey, currentCount + 1);

        return cacheKey;
    }

    /**
     * Deregister a consumer for a cache key.
     * Decrements reference counter and removes cache entry if no consumers remain.
     */
    deregisterConsumer(key: OnyxKey, cacheKey: string): void {
        const currentCount = this.cacheKeyRefCounts.get(cacheKey) || 0;

        if (currentCount <= 1) {
            // Last consumer - remove from reference counter and cache
            this.cacheKeyRefCounts.delete(cacheKey);

            // Remove from snapshot cache
            const keyCache = this.snapshotCache.get(key);
            if (keyCache) {
                keyCache.delete(cacheKey);
                // If this was the last cache entry for this Onyx key, remove the key entirely
                if (keyCache.size === 0) {
                    this.snapshotCache.delete(key);
                }
            }
        } else {
            // Still has other consumers - just decrement count
            this.cacheKeyRefCounts.set(cacheKey, currentCount - 1);
        }
    }

    /**
     * Get cached snapshot result for a key and cache key combination
     */
    getCachedResult<TResult extends UseOnyxResult<OnyxValue<OnyxKey>>>(key: OnyxKey, cacheKey: string): TResult | undefined {
        const keyCache = this.snapshotCache.get(key);
        return keyCache?.get(cacheKey) as TResult | undefined;
    }

    /**
     * Set cached snapshot result for a key and cache key combination
     */
    setCachedResult<TResult extends UseOnyxResult<OnyxValue<OnyxKey>>>(key: OnyxKey, cacheKey: string, result: TResult): void {
        if (!this.snapshotCache.has(key)) {
            this.snapshotCache.set(key, new Map());
        }
        this.snapshotCache.get(key)!.set(cacheKey, result);
    }

    /**
     * Selective cache invalidation to prevent data unavailability
     * Collection members invalidate upward, collections don't cascade downward
     */
    invalidateForKey(keyToInvalidate: OnyxKey): void {
        // Always invalidate the exact key
        this.snapshotCache.delete(keyToInvalidate);

        // Check if the key is a collection member and invalidate the collection base key
        const collectionBaseKey = OnyxUtils.getCollectionKey(keyToInvalidate);
        if (collectionBaseKey) {
            this.snapshotCache.delete(collectionBaseKey);
        }
    }

    /**
     * Clear all snapshot cache
     */
    clear(): void {
        this.snapshotCache.clear();
    }

    /**
     * Clear selector ID mappings (useful for testing)
     */
    clearSelectorIds(): void {
        this.selectorIDCounter = 0;
    }
}

// Create and export a singleton instance
const onyxSnapshotCache = new OnyxSnapshotCache();

export default onyxSnapshotCache;
export {OnyxSnapshotCache};
