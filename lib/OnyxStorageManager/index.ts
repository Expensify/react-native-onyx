import bindAll from 'lodash/bindAll';
import type {OnyxKey} from '../types';
import Storage from '../storage';
import * as Logger from '../Logger';
import type {StorageUsageConfig, StorageKeyInfo, StorageMetadata, StorageCleanupResult, CleanupExecutionResult} from './types';
import {DEFAULT_STORAGE_CONFIG} from './types';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const METADATA_KEY_PREFIX = '__onyx_meta_';

class OnyxStorageManager {
    /**
     * Stores metadata and tracking information for each Onyx key in storage.
     * Used to determine when a key was last accessed, created, etc.
     */
    private keyInfoMap = new Map<OnyxKey, StorageKeyInfo>();

    /**
     * Current configuration for storage usage and eviction policies.
     * Controls parameters like max idle days, max age, and which keys are evictable.
     */
    public config: StorageUsageConfig;

    /**
     * List of keys that are eligible for eviction based on the current config.
     * Only these keys will be considered for automatic cleanup.
     */
    private evictableKeys: OnyxKey[] = [];

    /**
     * Indicates whether the storage manager has been initialized.
     * Prevents redundant initialization and ensures setup is only performed once.
     */
    private isInitialized = false;

    /**
     * Reference to the interval timer used for periodic monitoring and cleanup.
     * If null, monitoring is not currently active.
     */
    private monitoringInterval: NodeJS.Timeout | null = null;

    /**
     * Flag indicating whether the storage manager is currently monitoring for cleanup.
     * Used to prevent multiple monitoring intervals from being started.
     */
    private isMonitoring = false;

    /**
     * Flag indicating whether a cleanup operation is currently in progress.
     * Prevents concurrent cleanups and ensures only one cleanup runs at a time.
     */
    private cleanupInProgress = false;

    constructor() {
        this.config = {...DEFAULT_STORAGE_CONFIG};
        this.setEvictableKeys(this.config.evictableKeys);

        bindAll(this, 'initialize', 'trackKeySet', 'trackKeyRemoval', 'setEvictableKeys', 'shouldPerformCleanup', 'performCleanup');
    }

    /**
     * Initializes the StorageManager by setting up tracking, starting monitoring, and performing initial cleanup if needed.
     * @param config - Configuration object to override default settings
     * @returns Promise that resolves when initialization is complete
     */
    initialize(config: Partial<StorageUsageConfig> = {}): Promise<void> {
        if (this.isInitialized) {
            Logger.logInfo('StorageManager already initialized');
            return Promise.resolve();
        }

        // Update config with provided values
        this.config = {...DEFAULT_STORAGE_CONFIG, ...config};
        this.setEvictableKeys(this.config.evictableKeys);

        Logger.logInfo('Initializing StorageManager...');

        return this.initializeTracking()
            .then(() => this.startMonitoring())
            .then(() => {
                if (!this.shouldPerformCleanup()) {
                    return;
                }
                Logger.logInfo('Performing initial storage cleanup');
                return this.performCleanup();
            })
            .then(() => {
                this.isInitialized = true;
                Logger.logInfo('StorageManager initialized successfully');
            })
            .catch((error) => {
                Logger.logAlert(`Failed to initialize StorageManager: ${error}`);
                throw error;
            });
    }

    private initializeTracking(): Promise<void> {
        Logger.logInfo('Initializing storage usage tracking...');

        return Storage.getAllKeys()
            .then((allKeys) => {
                Logger.logInfo(`Found ${allKeys.length} keys in storage`);
                return this.trackExistingKeys(allKeys);
            })
            .then(() => undefined)
            .catch((error) => {
                Logger.logAlert(`Failed to initialize storage tracking: ${error}`);
            });
    }

    private trackExistingKeys(keys: OnyxKey[]): Promise<void> {
        const dataKeys = keys.filter((key) => !key.startsWith(METADATA_KEY_PREFIX));
        const evictableDataKeys = dataKeys.filter((key) => this.isKeyEvictable(key));
        Logger.logInfo(`[StorageManager] Filtering keys: ${dataKeys.length} total, ${evictableDataKeys.length} evictable`);

        const trackingPromises = evictableDataKeys.map((key) => this.initializeKeyTracking(key));

        return Promise.all(trackingPromises).then(() => undefined);
    }

    private initializeKeyTracking(key: OnyxKey): Promise<void> {
        const now = Date.now();

        return this.loadMetadata(key)
            .then((metadata) => {
                const keyInfo: StorageKeyInfo = {
                    key,
                    lastAccessed: metadata?.lastAccessed ?? now,
                    createdAt: metadata?.createdAt ?? now,
                };

                this.keyInfoMap.set(key, keyInfo);

                if (!metadata) {
                    return this.saveMetadata(key, {
                        lastAccessed: now,
                        createdAt: now,
                    }).catch((error) => {
                        Logger.logInfo(`Failed to create initial metadata for ${key}: ${error}`);
                    });
                }
                return Promise.resolve();
            })
            .catch((error) => {
                Logger.logInfo(`Failed to initialize tracking for key ${key}: ${error}`);
            });
    }

    /**
     * Tracks when a key is set in storage, updating access metadata.
     * @param key - The storage key that was set
     */
    trackKeySet(key: OnyxKey): void {
        if (!this.isInitialized) {
            Logger.logInfo(`StorageManager not initialized, skipping tracking for key: ${key}`);
            return;
        }

        const isEvictable = this.isKeyEvictable(key);
        const now = Date.now();
        const existing = this.keyInfoMap.get(key);

        this.updateKeyInfo(key, now, isEvictable, !existing);
    }

    private updateKeyInfo(key: OnyxKey, now: number, isEvictable: boolean, isNewKey = false): void {
        const existing = this.keyInfoMap.get(key);
        const keyInfo: StorageKeyInfo = {
            key,
            lastAccessed: now,
            createdAt: isNewKey ? now : existing?.createdAt || now,
        };

        this.keyInfoMap.set(key, keyInfo);

        if (isEvictable) {
            const metadata: StorageMetadata = {
                lastAccessed: now,
                createdAt: keyInfo.createdAt,
            };
            this.saveMetadata(key, metadata).catch((error) => {
                Logger.logInfo(`Failed to save metadata for ${key}: ${error}`);
            });
        }
    }

    /**
     * Tracks when a key is removed from storage, cleaning up associated metadata.
     * @param key - The storage key that was removed
     */
    trackKeyRemoval(key: OnyxKey): void {
        if (!this.isInitialized) {
            Logger.logInfo(`StorageManager not initialized, skipping removal tracking for key: ${key}`);
            return;
        }

        const removedKeyInfo = this.keyInfoMap.get(key);
        this.keyInfoMap.delete(key);

        if (removedKeyInfo && this.isKeyEvictable(key)) {
            const metadataKey = this.getMetadataKey(key);
            Storage.removeItem(metadataKey).catch((error) => {
                Logger.logInfo(`Failed to remove metadata for ${key}: ${error}`);
            });
        }
    }

    /**
     * Updates the list of keys that are eligible for eviction.
     * @param keys - Array of Onyx keys or collection keys
     */
    setEvictableKeys(keys: OnyxKey[]): void {
        this.evictableKeys = keys;
    }

    private isKeyEvictable(key: OnyxKey): boolean {
        return this.evictableKeys.some((pattern) => {
            if (pattern.endsWith('_')) {
                return key.startsWith(pattern);
            }
            return key === pattern;
        });
    }

    private getEvictableKeysCount(): number {
        let count = 0;
        for (const keyInfo of this.keyInfoMap.values()) {
            if (this.isKeyEvictable(keyInfo.key)) {
                count++;
            }
        }
        return count;
    }

    private getMetadataKey(key: OnyxKey): string {
        return `${METADATA_KEY_PREFIX}${key}`;
    }

    private saveMetadata(key: OnyxKey, metadata: StorageMetadata): Promise<void> {
        const metadataKey = this.getMetadataKey(key);

        return Storage.setItem(metadataKey, metadata).catch((error) => {
            Logger.logInfo(`Failed to save metadata for ${key}: ${error}`);
            throw error;
        });
    }

    private loadMetadata(key: OnyxKey): Promise<StorageMetadata | null> {
        const metadataKey = this.getMetadataKey(key);
        return Storage.getItem(metadataKey)
            .then((metadata) => {
                return metadata as StorageMetadata;
            })
            .catch((error) => {
                Logger.logInfo(`Failed to load metadata for ${key}: ${error}`);
                return null;
            });
    }

    /**
     * Determines if storage cleanup should be performed based on configuration and current state.
     * @returns true if cleanup should be performed, false otherwise
     */
    shouldPerformCleanup(): boolean {
        const now = Date.now();

        if (!this.config.enabled) {
            Logger.logInfo('Storage eviction is disabled');
            return false;
        }

        const evictableCount = this.getEvictableKeysCount();
        Logger.logInfo(`Evictable keys count: ${evictableCount}, total keys: ${this.keyInfoMap.size}`);

        if (evictableCount === 0) {
            Logger.logInfo('No evictable keys found');
            // Debug: log all tracked keys and evictable patterns
            const allKeys = Array.from(this.keyInfoMap.keys());
            Logger.logInfo(`All tracked keys: [${allKeys.join(', ')}]`);
            Logger.logInfo(`Evictable patterns: [${this.evictableKeys.join(', ')}]`);
            return false;
        }

        let expiredCount = 0;
        for (const keyInfo of this.keyInfoMap.values()) {
            if (this.isKeyEvictable(keyInfo.key)) {
                const shouldEvict = this.shouldEvictKey(keyInfo);
                const daysSinceAccess = (now - keyInfo.lastAccessed) / MILLISECONDS_PER_DAY;
                const ageInDays = (now - keyInfo.createdAt) / MILLISECONDS_PER_DAY;

                Logger.logInfo(`Key ${keyInfo.key}: age=${ageInDays.toFixed(4)}d, idle=${daysSinceAccess.toFixed(4)}d, shouldEvict=${shouldEvict}`);

                if (shouldEvict) {
                    expiredCount++;
                }
            }
        }

        if (expiredCount > 0) {
            Logger.logInfo(`Found ${expiredCount} expired keys, cleanup needed`);
            return true;
        }

        Logger.logInfo('No expired keys found');
        return false;
    }

    private startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        // Clear any existing interval to prevent memory leaks
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.isMonitoring = true;

        Logger.logInfo('Storage monitoring started');

        this.monitoringInterval = setInterval(() => {
            try {
                if (this.shouldPerformCleanup() && !this.cleanupInProgress) {
                    Logger.logInfo(`Automatic cleanup triggered - evictableKeys: ${this.getEvictableKeysCount()}`);

                    // Don't set cleanupInProgress here - let performCleanup() handle it
                    this.performCleanup()
                        .then((result) => {
                            Logger.logInfo(
                                `Cleanup completed - cleanedKeys: ${result.cleanedKeys.length}, timeElapsed: ${result.timeElapsed}ms, errors: ${
                                    result.errors.length > 0 ? result.errors.join(', ') : 'None'
                                }`,
                            );
                        })
                        .catch((error) => {
                            Logger.logAlert(`Monitor cleanup failed: ${error}`);
                        });
                }
            } catch (error) {
                Logger.logInfo(`Storage monitoring error: ${error}`);
            }
        }, this.config.cleanupInterval);
    }

    /**
     * Performs storage cleanup by removing expired keys based on idle time and age limits.
     * @returns Promise resolving to cleanup results including cleaned keys, time elapsed, and any errors
     */
    performCleanup(): Promise<StorageCleanupResult> {
        if (!this.config.enabled) {
            return Promise.resolve({
                cleanedKeys: [],
                timeElapsed: 0,
                errors: ['Storage eviction is disabled'],
            });
        }

        if (this.cleanupInProgress) {
            return Promise.resolve({
                cleanedKeys: [],
                timeElapsed: 0,
                errors: ['Cleanup already in progress'],
            });
        }

        this.cleanupInProgress = true;

        const startTime = Date.now();
        const cleanedKeys: OnyxKey[] = [];
        const errors: string[] = [];

        Logger.logInfo('Starting storage cleanup');

        Logger.logInfo(`Storage usage: ${this.keyInfoMap.size} keys, ${this.getEvictableKeysCount()} evictable`);

        const keysToEvict: StorageKeyInfo[] = [];
        for (const keyInfo of this.keyInfoMap.values()) {
            if (this.isKeyEvictable(keyInfo.key) && this.shouldEvictKey(keyInfo)) {
                keysToEvict.push(keyInfo);
            }
        }

        Logger.logInfo(`Found ${keysToEvict.length} keys to evict`);

        if (keysToEvict.length === 0) {
            return Promise.resolve({
                cleanedKeys: [],
                timeElapsed: Date.now() - startTime,
                errors: ['No evictable keys found'],
            });
        }

        return this.executeCleanup(keysToEvict)
            .then(({successfulKeys, failedKeys}) => {
                cleanedKeys.push(...successfulKeys);

                if (failedKeys.length > 0) {
                    errors.push(`Failed to clean ${failedKeys.length} keys: ${failedKeys.join(', ')}`);
                }

                const successfulKeysSet = new Set(successfulKeys);
                for (const key of successfulKeysSet) {
                    this.trackKeyRemoval(key);
                }

                Logger.logInfo(`Storage cleanup completed: cleaned ${cleanedKeys.length} keys`);

                return {
                    cleanedKeys,
                    timeElapsed: Date.now() - startTime,
                    errors,
                };
            })
            .finally(() => {
                this.cleanupInProgress = false;
            });
    }

    private shouldEvictKey(keyInfo: StorageKeyInfo): boolean {
        if (!this.config.enabled) return false;

        const now = Date.now();
        const daysSinceAccess = (now - keyInfo.lastAccessed) / MILLISECONDS_PER_DAY;
        const ageInDays = (now - keyInfo.createdAt) / MILLISECONDS_PER_DAY;

        return daysSinceAccess > this.config.maxIdleDays || ageInDays > this.config.maxAgeDays;
    }

    private executeCleanup(keysToEvict: StorageKeyInfo[]): Promise<CleanupExecutionResult> {
        const successfulKeys: OnyxKey[] = [];
        const failedKeys: OnyxKey[] = [];

        const cleanupPromises = keysToEvict.map((keyInfo) => {
            return Storage.removeItem(keyInfo.key)
                .then(() => {
                    successfulKeys.push(keyInfo.key);
                })
                .catch((error) => {
                    Logger.logInfo(`Failed to remove key ${keyInfo.key}: ${error}`);
                    failedKeys.push(keyInfo.key);
                });
        });

        return Promise.all(cleanupPromises).then(() => ({successfulKeys, failedKeys}));
    }
}

const storageManager = new OnyxStorageManager();

/**
 * Enables storage eviction for the StorageManager instance.
 * Allows automatic cleanup of expired keys based on configured rules.
 */
function enableStorageEviction(): void {
    storageManager.config.enabled = true;
    Logger.logInfo('Storage eviction enabled');
}

/**
 * Disables storage eviction for the StorageManager instance.
 * Prevents automatic cleanup of keys regardless of age or idle time.
 */
function disableStorageEviction(): void {
    storageManager.config.enabled = false;
    Logger.logInfo('Storage eviction disabled');
}

/**
 * Checks if storage eviction is currently enabled.
 * @returns true if eviction is enabled, false otherwise
 */
function isStorageEvictionEnabled(): boolean {
    return storageManager.config.enabled;
}

export default storageManager;
export {OnyxStorageManager, enableStorageEviction, disableStorageEviction, isStorageEvictionEnabled, DEFAULT_STORAGE_CONFIG};
