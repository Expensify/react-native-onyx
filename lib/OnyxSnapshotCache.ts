import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';
import type {UseOnyxOptions, UseOnyxResult, UseOnyxSelector} from './useOnyx';

/**
 * Manages snapshot caching for useOnyx hook performance optimization.
 * Handles selector function tracking and memoized getSnapshot results.
 */
class OnyxSnapshotCache {
    /**
     * Snapshot cache for ultimate performance - separate cache per Onyx key
     */
    private snapshotCache: Map<OnyxKey, Map<string, UseOnyxResult<OnyxValue<OnyxKey>>>>;

    /**
     * Maps selector functions to unique IDs for cache key generation
     */
    private selectorIdMap: Map<UseOnyxSelector<OnyxKey, unknown>, number>;

    /**
     * Counter for generating incremental selector IDs
     */
    private selectorIdCounter: number;

    constructor() {
        this.snapshotCache = new Map();
        this.selectorIdMap = new Map();
        this.selectorIdCounter = 0;
    }

    /**
     * Generate unique ID for selector functions using incrementing numbers
     */
    getSelectorId<TKey extends OnyxKey, TReturnValue>(selector: UseOnyxSelector<TKey, TReturnValue>): number {
        const typedSelector = selector as unknown as UseOnyxSelector<OnyxKey, unknown>;
        if (!this.selectorIdMap.has(typedSelector)) {
            const id = this.selectorIdCounter++;
            this.selectorIdMap.set(typedSelector, id);
        }
        return this.selectorIdMap.get(typedSelector)!;
    }

    /**
     * Fast cache key generation for useOnyx options combination.
     *
     * The properties used to generate the cache key are handpicked for performance reasons and
     * according to their purpose and effect they produce in the useOnyx hook behavior:
     *
     * - `selector`: Different selectors produce different results, so each selector needs its own cache entry
     * - `initWithStoredValues`: This flag changes the initial loading behavior and affects the returned fetch status
     * - `allowStaleData`: Controls whether stale data can be returned during pending merges, affecting result timing
     * - `canBeMissing`: Determines logging behavior for missing data, but doesn't affect the actual data returned
     *
     * Other options like `canEvict`, `reuseConnection`, and `allowDynamicKey` don't affect the data transformation
     * or timing behavior of getSnapshot, so they're excluded from the cache key for better cache hit rates.
     */
    generateCacheKey<TKey extends OnyxKey, TReturnValue>(options: Pick<UseOnyxOptions<TKey, TReturnValue>, 'selector' | 'initWithStoredValues' | 'allowStaleData' | 'canBeMissing'>): string {
        const selectorId = options?.selector ? this.getSelectorId(options.selector) : 'no_selector';
        // Create options hash without expensive JSON.stringify
        const initWithStoredValues = options?.initWithStoredValues ?? true;
        const allowStaleData = options?.allowStaleData ?? false;
        const canBeMissing = options?.canBeMissing ?? true;
        return `${selectorId}_${initWithStoredValues}_${allowStaleData}_${canBeMissing}`;
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

        // Handle collection-related keys with selective invalidation
        if (OnyxUtils.isCollectionKey(keyToInvalidate)) {
            const baseKey = OnyxUtils.getCollectionKey(keyToInvalidate);

            // If this is a collection member key (e.g., "reports_123")
            // Only invalidate upward to the collection base key
            if (baseKey !== keyToInvalidate) {
                this.snapshotCache.delete(baseKey);
            }
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
        this.selectorIdMap.clear();
        this.selectorIdCounter = 0;
    }
}

// Create and export a singleton instance
const onyxSnapshotCache = new OnyxSnapshotCache();

export default onyxSnapshotCache;
export {OnyxSnapshotCache};
