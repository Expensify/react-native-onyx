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
     * Counter for generating unique selector IDs
     */
    private selectorCounter: number;

    constructor() {
        this.snapshotCache = new Map();
        this.selectorIdMap = new Map();
        this.selectorCounter = 0;
    }

    /**
     * Generate unique ID for selector functions
     */
    getSelectorId(selector: UseOnyxSelector<any, any>): string {
        if (!this.selectorIdMap.has(selector)) {
            this.selectorIdMap.set(selector, `selector_${++this.selectorCounter}`);
        }
        return this.selectorIdMap.get(selector)!;
    }

    /**
     * Fast cache key generation for selector/options combination
     */
    generateSelectorKey<TKey extends OnyxKey, TReturnValue>(options?: UseOnyxOptions<TKey, TReturnValue>): string {
        const selectorId = options?.selector ? this.getSelectorId(options.selector) : 'no_selector';
        // Create options hash without expensive JSON.stringify
        const initWithStoredValues = options?.initWithStoredValues ?? true;
        const allowStaleData = options?.allowStaleData ?? false;
        const canBeMissing = options?.canBeMissing ?? true;
        return `${selectorId}_${initWithStoredValues}_${allowStaleData}_${canBeMissing}`;
    }

    /**
     * Get cached snapshot result for a key and selector combination
     */
    getCachedResult(key: string, selectorKey: string): any {
        const keyCache = this.snapshotCache.get(key);
        return keyCache?.get(selectorKey);
    }

    /**
     * Set cached snapshot result for a key and selector combination
     */
    setCachedResult(key: string, selectorKey: string, result: any): void {
        if (!this.snapshotCache.has(key)) {
            this.snapshotCache.set(key, new Map());
        }
        this.snapshotCache.get(key)!.set(selectorKey, result);
    }

    /**
     * O(1) cache invalidation - just delete the entire cache for this key
     */
    invalidateForKey(keyToInvalidate: string): void {
        this.snapshotCache.delete(keyToInvalidate);
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
        this.selectorCounter = 0;
    }
}

// Create and export a singleton instance
const onyxSnapshotCache = new OnyxSnapshotCache();

export default onyxSnapshotCache;
export {OnyxSnapshotCache};
