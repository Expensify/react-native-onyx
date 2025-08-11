import OnyxUtils from './OnyxUtils';
import type {OnyxKey} from './types';
import type {UseOnyxOptions, UseOnyxSelector} from './useOnyx';

/**
 * Manages snapshot caching for useOnyx hook performance optimization.
 * Handles selector function tracking and memoized getSnapshot results.
 */
class OnyxSnapshotCache {
    /**
     * Snapshot cache for ultimate performance - separate cache per Onyx key
     */
    private snapshotCache: Map<string, Map<string, unknown>>;

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
     * Fast cache key generation for useOnyx options combination
     */
    generateCacheKey<TKey extends OnyxKey, TReturnValue>(options?: UseOnyxOptions<TKey, TReturnValue>): string {
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
    getCachedResult<T>(key: string, cacheKey: string): T | undefined {
        const keyCache = this.snapshotCache.get(key);
        return keyCache?.get(cacheKey) as T | undefined;
    }

    /**
     * Set cached snapshot result for a key and cache key combination
     */
    setCachedResult<T>(key: string, cacheKey: string, result: T): void {
        if (!this.snapshotCache.has(key)) {
            this.snapshotCache.set(key, new Map());
        }
        this.snapshotCache.get(key)!.set(cacheKey, result);
    }

    /**
     * O(1) cache invalidation - delete cache for this key and related collection keys
     */
    invalidateForKey(keyToInvalidate: string): void {
        // Always invalidate the exact key
        this.snapshotCache.delete(keyToInvalidate);

        // For collection member keys, also invalidate the parent collection
        if (OnyxUtils.isCollectionKey(keyToInvalidate)) {
            const baseKey = OnyxUtils.getCollectionKey(keyToInvalidate);
            // Invalidate all related collection members
            for (const [cacheKey] of this.snapshotCache) {
                if (cacheKey.startsWith(baseKey) || cacheKey === baseKey) {
                    this.snapshotCache.delete(cacheKey);
                }
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
