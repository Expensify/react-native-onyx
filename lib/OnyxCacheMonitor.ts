import cache from './OnyxCache';
import * as Logger from './Logger';
import type {OnyxKey} from './types';

type CacheMetrics = {
    timestamp: number;
    storageKeysSize: number;
    nullishStorageKeysSize: number;
    recentKeysSize: number;
    storageMapSize: number;
    storageMapMemoryEstimate: number;
    operationCounters: Record<string, number>;
    maxCacheLimit: number;
    memoryUsage: number;
    memoryLimit: number;
    expiredKeysCleanedCount: number;
    lastExpirationCleanupTime: number;
    expirationTimeMs: number;
};

type CacheMethod = 'get' | 'getAllKeys' | 'set' | 'drop' | 'merge' | 'hasCacheForKey';

// Define a type for the private cache structure
interface PrivateCache {
    storageKeys: Set<unknown>;
    nullishStorageKeys: Set<unknown>;
    recentKeys: Set<unknown>;
    storageMap: Record<string, unknown>;
    maxRecentKeysSize: number;
}

/**
 * Monitors the OnyxCache to track size metrics and operation performance
 */
class OnyxCacheMonitor {
    private isEnabled = false;

    private metricsHistory: CacheMetrics[] = [];

    private operationCounters: Record<string, number> = {};

    private sampleInterval: number | null = null;

    private maxHistoryLength = 100;

    private originalMethods: Record<CacheMethod, (key: OnyxKey, ...args: unknown[]) => unknown> = {} as Record<CacheMethod, (key: OnyxKey, ...args: unknown[]) => unknown>;

    constructor() {
        // Initialize operation counters for all public methods
        ['get', 'getAllKeys', 'set', 'drop', 'merge', 'hasCacheForKey'].forEach((method) => {
            this.operationCounters[method] = 0;
        });
    }

    /**
     * Enable the cache monitor
     * @param sampleIntervalMs How often to sample cache metrics (milliseconds)
     * @param maxHistory Maximum number of history entries to keep
     */
    enable(sampleIntervalMs = 5000, maxHistory = 100): void {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.maxHistoryLength = maxHistory;

        // Monkey patch the cache methods to track operation counts
        this.monkeyPatchCacheMethods();

        // Take initial measurement
        this.measureCacheMetrics();

        // Set up interval for periodic measurements
        this.sampleInterval = setInterval(() => {
            this.measureCacheMetrics();
        }, sampleIntervalMs) as unknown as number;

        Logger.logInfo('OnyxCacheMonitor enabled');
    }

    /**
     * Disable the cache monitor
     */
    disable(): void {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        if (this.sampleInterval !== null) {
            clearInterval(this.sampleInterval as unknown as number);
            this.sampleInterval = null;
        }

        // Remove the monkey patching
        this.restoreCacheMethods();

        Logger.logInfo('OnyxCacheMonitor disabled');
    }

    /**
     * Create a report of the current cache state
     */
    generateReport(): string {
        const currentMetrics = this.getCurrentMetrics();
        const operationCounts = this.getOperationCounts();
        const performanceInsights = this.analyzePerformance(currentMetrics);

        this.logCacheState(currentMetrics);
        this.logMostRecentKeys();

        // Format the last expiration cleanup time
        const lastCleanupTimeFormatted = currentMetrics.lastExpirationCleanupTime > 0 ? new Date(currentMetrics.lastExpirationCleanupTime).toISOString() : 'Never';

        // Calculate expiration time in readable format
        const expirationHours = Math.round(currentMetrics.expirationTimeMs / (60 * 60 * 1000));

        return `
OnyxCache Performance Report:
=============================
Time: ${new Date(currentMetrics.timestamp).toISOString()}

Cache Configuration:
- Max Cached Keys Limit: ${currentMetrics.maxCacheLimit}
- Memory Limit: ${currentMetrics.memoryLimit.toFixed(2)} MB
- Key Expiration Time: ${expirationHours} hours

Cache Sizes:
- Storage Keys: ${currentMetrics.storageKeysSize}
- Nullish Storage Keys: ${currentMetrics.nullishStorageKeysSize}
- Recent Keys: ${currentMetrics.recentKeysSize}
- Storage Map Entries: ${currentMetrics.storageMapSize}
- Memory Usage: ${currentMetrics.memoryUsage.toFixed(2)} MB (${((currentMetrics.memoryUsage / currentMetrics.memoryLimit) * 100).toFixed(2)}%)
- Estimated Memory Usage (alternative): ${Math.round(currentMetrics.storageMapMemoryEstimate / 1024)} KB

Expiration Metrics:
- Total Expired Keys Cleaned: ${currentMetrics.expiredKeysCleanedCount}
- Last Cleanup Time: ${lastCleanupTimeFormatted}

Operation Counts:
${Object.entries(operationCounts)
    .map(([method, count]) => `- ${method}: ${count} calls`)
    .join('\n')}

Performance Insights:
${performanceInsights.length > 0 ? performanceInsights.map((insight) => `- ${insight}`).join('\n') : '- No performance issues detected'}

History:
- Samples: ${this.metricsHistory.length}
- Duration: ${this.metricsHistory.length > 1 ? Math.round((currentMetrics.timestamp - this.metricsHistory[0].timestamp) / 1000) : 0} seconds
`.trim();
    }

    /**
     * Get the current cache metrics
     */
    private getCurrentMetrics(): CacheMetrics {
        return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : this.measureCacheMetrics();
    }

    /**
     * Get operation counts
     */
    private getOperationCounts(): Record<string, number> {
        return {...this.operationCounters};
    }

    /**
     * Estimate the number of bytes used by the cache
     */
    private estimateStorageMapSize(): number {
        try {
            // Using JSON.stringify to get a rough estimate of object size
            // Access the private storageMap through an indirect approach
            const cacheAsUnknown = cache as unknown as {storageMap: Record<string, unknown>};
            const storageMapString = JSON.stringify(cacheAsUnknown.storageMap);
            return storageMapString.length;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Measure current cache metrics and add to history
     */
    private measureCacheMetrics(): CacheMetrics {
        const privateCache = cache as unknown as PrivateCache;

        // Ensure we get the maxRecentKeysSize correctly, add extra check for debugging
        const maxCacheLimitValue = privateCache.maxRecentKeysSize || 0;
        if (maxCacheLimitValue === 0) {
            Logger.logInfo('OnyxCacheMonitor: Warning - maxRecentKeysSize is 0, cache limit tracking will be inaccurate');
        }

        // Get memory metrics from the cache (new method)
        const memoryUsage = (cache as unknown as {getMemoryUsage: () => number}).getMemoryUsage?.() || 0;
        const memoryLimit = (cache as unknown as {getMemoryLimit: () => number}).getMemoryLimit?.() || 0;

        // Get expiration metrics from the cache
        const expiredKeysCleanedCount = (cache as unknown as {getExpiredKeysCleanedCount: () => number}).getExpiredKeysCleanedCount?.() || 0;
        const lastExpirationCleanupTime = (cache as unknown as {getLastExpirationCleanupTime: () => number}).getLastExpirationCleanupTime?.() || 0;
        const expirationTimeMs = (cache as unknown as {getExpirationTimeMs: () => number}).getExpirationTimeMs?.() || 0;

        const metrics: CacheMetrics = {
            timestamp: Date.now(),
            storageKeysSize: privateCache.storageKeys?.size || 0,
            nullishStorageKeysSize: privateCache.nullishStorageKeys?.size || 0,
            recentKeysSize: privateCache.recentKeys?.size || 0,
            storageMapSize: Object.keys(privateCache.storageMap || {}).length,
            storageMapMemoryEstimate: this.estimateStorageMapSize(),
            operationCounters: {...this.operationCounters},
            maxCacheLimit: maxCacheLimitValue,
            memoryUsage,
            memoryLimit,
            expiredKeysCleanedCount,
            lastExpirationCleanupTime,
            expirationTimeMs,
        };

        this.metricsHistory.push(metrics);

        // Trim history if needed
        if (this.metricsHistory.length > this.maxHistoryLength) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistoryLength);
        }

        return metrics;
    }

    /**
     * Apply performance tracking to cache methods
     */
    private monkeyPatchCacheMethods(): void {
        const methodsToTrack: CacheMethod[] = ['get', 'getAllKeys', 'set', 'drop', 'merge', 'hasCacheForKey'];

        methodsToTrack.forEach((method) => {
            if (typeof cache[method as keyof typeof cache] !== 'function') {
                return;
            }

            const originalMethod = cache[method as keyof typeof cache] as unknown as (key: OnyxKey, ...args: unknown[]) => unknown;
            this.originalMethods[method] = originalMethod;

            const cacheAsUnknown = cache as unknown;
            (cacheAsUnknown as Record<string, unknown>)[method] = (...args: [OnyxKey, ...unknown[]]) => {
                this.operationCounters[method]++;

                return this.originalMethods[method].apply(cache, args);
            };
        });

        Logger.logInfo('OnyxCacheMonitor: Methods patched for operation counting');
    }

    /**
     * Restore original cache methods
     */
    private restoreCacheMethods(): void {
        if (!this.originalMethods) {
            return;
        }

        Object.keys(this.originalMethods).forEach((method) => {
            const cacheAsUnknown = cache as unknown;
            (cacheAsUnknown as Record<string, unknown>)[method] = this.originalMethods[method as CacheMethod];
        });
        this.originalMethods = {} as Record<CacheMethod, (key: OnyxKey, ...args: unknown[]) => unknown>;
    }

    /**
     * Analyze the current metrics and identify potential performance issues
     */
    private analyzePerformance(metrics: CacheMetrics): string[] {
        const insights: string[] = [];

        // Check for high memory usage (threshold: 10MB)
        const memoryMB = metrics.memoryUsage;
        if (memoryMB > 10) {
            insights.push(`HIGH MEMORY USAGE: ${memoryMB.toFixed(2)}MB exceeds recommended limit of 10MB`);
        }

        // Memory usage threshold analysis (if memory limit is set)
        if (metrics.memoryLimit > 0) {
            const memoryUsagePercentage = (metrics.memoryUsage / metrics.memoryLimit) * 100;

            if (memoryUsagePercentage > 90) {
                insights.push(`CRITICAL: Memory usage at ${memoryUsagePercentage.toFixed(2)}% of maximum limit`);
            } else if (memoryUsagePercentage > 75) {
                insights.push(`WARNING: Memory usage at ${memoryUsagePercentage.toFixed(2)}% of maximum limit`);
            }

            // Memory usage trend analysis
            if (this.metricsHistory.length > 2) {
                const previousMetric = this.metricsHistory[this.metricsHistory.length - 2];
                const memoryGrowthRate = ((metrics.memoryUsage - previousMetric.memoryUsage) / previousMetric.memoryUsage) * 100;

                if (memoryGrowthRate > 20) {
                    insights.push(`RAPID GROWTH: Memory usage increased by ${memoryGrowthRate.toFixed(2)}% since last check`);
                }
            }
        }

        // Analyze expiration patterns
        if (metrics.expiredKeysCleanedCount > 0) {
            // Check if a large number of keys were expired in the last sample
            if (this.metricsHistory.length > 1) {
                const previousMetric = this.metricsHistory[this.metricsHistory.length - 2];
                const recentlyExpiredKeys = metrics.expiredKeysCleanedCount - previousMetric.expiredKeysCleanedCount;

                if (recentlyExpiredKeys > 50) {
                    insights.push(`HIGH EXPIRATION RATE: ${recentlyExpiredKeys} keys expired since last check`);
                }
            }
        }

        // Cache limit analysis - maintain for backward compatibility
        if (metrics.maxCacheLimit > 0) {
            // LRU cache utilization percentage - only show warning if we have at least 10 keys to avoid false positives
            const utilizationPercentage = (metrics.recentKeysSize / metrics.maxCacheLimit) * 100;
            if (metrics.recentKeysSize > 10 && utilizationPercentage > 90) {
                insights.push(`HIGH KEY COUNT: Using ${utilizationPercentage.toFixed(2)}% of available key slots (${metrics.recentKeysSize}/${metrics.maxCacheLimit})`);
            }

            // Check growth rate
            if (this.metricsHistory.length > 2) {
                const previousMetric = this.metricsHistory[this.metricsHistory.length - 2];
                const growthRate = (metrics.recentKeysSize - previousMetric.recentKeysSize) / previousMetric.recentKeysSize;

                if (growthRate > 0.2 && metrics.recentKeysSize > previousMetric.recentKeysSize + 10) {
                    insights.push(`RAPID KEY GROWTH: ${metrics.recentKeysSize - previousMetric.recentKeysSize} keys added since last check (${(growthRate * 100).toFixed(2)}% increase)`);
                }
            }
        }

        // Check for large disparity between storage keys and recent keys
        const keyDisparity = metrics.storageKeysSize - metrics.recentKeysSize;
        if (keyDisparity > 100 && metrics.storageKeysSize > 0) {
            const disparityPercentage = (keyDisparity / metrics.storageKeysSize) * 100;
            if (disparityPercentage > 50) {
                insights.push(`CACHE MISS RISK: ${disparityPercentage.toFixed(2)}% of storage keys (${keyDisparity}) not in recent keys cache`);
            }
        }

        // Analyze operation distribution
        const writeOps = (metrics.operationCounters.set || 0) + (metrics.operationCounters.merge || 0);
        const totalOps = Object.values(metrics.operationCounters).reduce((sum, count) => sum + count, 0);

        if (totalOps > 100) {
            const writePercentage = (writeOps / totalOps) * 100;
            if (writePercentage > 70) {
                insights.push(`WRITE-HEAVY: ${writePercentage.toFixed(2)}% of operations are writes, consider optimizing`);
            }
        }

        return insights;
    }

    /**
     * Log the current cache state
     */
    logCacheState(metrics?: CacheMetrics): void {
        const currentMetrics = metrics || this.getCurrentMetrics();

        Logger.logInfo(`
    === OnyxCache State ===
    Total keys in storage: ${currentMetrics.storageKeysSize}
    Total keys in recentKeys (LRU): ${currentMetrics.recentKeysSize}
    Keys with nullish values: ${currentMetrics.nullishStorageKeysSize}
    Storage map entries: ${currentMetrics.storageMapSize}
    Memory usage: ${currentMetrics.memoryUsage.toFixed(2)}MB / ${currentMetrics.memoryLimit.toFixed(2)}MB (${((currentMetrics.memoryUsage / currentMetrics.memoryLimit) * 100).toFixed(2)}%)
    ======================
        `);
    }

    /**
     * Log the most recently used keys
     */
    logMostRecentKeys(keyCount = 20): void {
        const recentKeys = (cache as unknown as {getRecentlyUsedKeys: (count: number) => OnyxKey[]}).getRecentlyUsedKeys(keyCount);

        Logger.logInfo(`
    === ${keyCount} Most Recently Used Keys ===
    ${recentKeys.map((key, index) => `${index + 1}. ${key}`).join('\n')}
    ================================
        `);
    }
}

const instance = new OnyxCacheMonitor();

export default instance;
