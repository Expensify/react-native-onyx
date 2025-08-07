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
    private snapshotCache: Map<string, Map<string, any>>;

    /**
     * Maps selector functions to unique IDs for cache key generation
     */
    private selectorIdMap: Map<UseOnyxSelector<any, any>, string>;

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
    getSelectorId(selector: UseOnyxSelector<any, any>): string {
        if (!this.selectorIdMap.has(selector)) {
            const id = `selector_${this.selectorIdCounter++}`;
            this.selectorIdMap.set(selector, id);
        }
        return this.selectorIdMap.get(selector)!;
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
    getCachedResult(key: string, cacheKey: string): any {
        const keyCache = this.snapshotCache.get(key);
        return keyCache?.get(cacheKey);
    }

    /**
     * Set cached snapshot result for a key and cache key combination
     */
    setCachedResult(key: string, cacheKey: string, result: any): void {
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
