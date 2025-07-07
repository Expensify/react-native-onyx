import type {QueryResult, QueryResultRow} from 'react-native-nitro-sqlite';
import type {OnyxKey} from '../types';
import Storage from '../storage';
import * as Logger from '../Logger';
import type {StorageUsageConfig, StorageKeyInfo, StorageMetadata} from './types';
import {DEFAULT_STORAGE_CONFIG} from './types';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

// Type aliases
type StorageManagerConfig = Partial<StorageUsageConfig>;
type StorageCleanupResult = {cleanedKeys: OnyxKey[]; timeElapsed: number; errors: string[]};

class StorageManager {
    private keyInfoMap = new Map<OnyxKey, StorageKeyInfo>();

    private config: StorageUsageConfig;

    private evictableKeys = new Set<string>();

    private lastCleanup = 0;

    private isInitialized = false;

    private monitoringInterval: NodeJS.Timeout | null = null;

    private isMonitoring = false;

    private lastStatusLog = 0;

    constructor(config: Partial<StorageUsageConfig> = {}) {
        this.config = {...DEFAULT_STORAGE_CONFIG, ...config};
        console.log(`[StorageManager] Initialized with config:`, this.config);
        this.setEvictableKeys(this.config.evictableKeys);
    }

    initialize(): Promise<void> {
        if (this.isInitialized) {
            Logger.logInfo('StorageManager already initialized');
            return Promise.resolve();
        }

        Logger.logInfo('Initializing StorageManager...');

        return this.initializeTracking()
            .then(() => this.startMonitoring())
            .then(() => this.performInitialCleanupIfNeeded())
            .then(() => {
                this.isInitialized = true;
                Logger.logInfo('StorageManager initialized successfully');
            })
            .catch((error) => {
                Logger.logAlert(`Failed to initialize StorageManager: ${error}`);
                throw error;
            });
    }

    private initializeTracking(): Promise<void | Array<void | QueryResult<QueryResultRow>>> {
        Logger.logInfo('Initializing storage usage tracking...');

        return Storage.getAllKeys()
            .then((allKeys) => {
                Logger.logInfo(`Found ${allKeys.length} keys in storage`);
                return this.trackExistingKeys(allKeys);
            })
            .catch((error) => {
                Logger.logAlert(`Failed to initialize storage tracking: ${error}`);
            });
    }

    private trackExistingKeys(keys: OnyxKey[]): Promise<Array<void | QueryResult<QueryResultRow>>> {
        const dataKeys = keys.filter((key) => !key.startsWith('__onyx_meta_'));
        const evictableDataKeys = dataKeys.filter((key) => this.isKeyEvictable(key));

        console.log(`[StorageManager] Filtering keys: ${dataKeys.length} total, ${evictableDataKeys.length} evictable`);

        const trackingPromises = evictableDataKeys.map((key) => this.initializeKeyTracking(key));

        return Promise.all(trackingPromises);
    }

    private initializeKeyTracking(key: OnyxKey): Promise<void | QueryResult<QueryResultRow>> {
        const now = Date.now();

        return this.loadMetadata(key)
            .then((metadata) => {
                const keyInfo = {
                    key,
                    lastAccessed: metadata?.lastAccessed || now,
                    accessCount: metadata?.accessCount || 1,
                    createdAt: metadata?.createdAt || now,
                    isEvictable: true,
                };

                this.keyInfoMap.set(key, keyInfo);

                if (!metadata) {
                    console.log(`[StorageManager] Creating metadata for key: ${key}`, {
                        lastAccessed: now,
                        accessCount: 1,
                        createdAt: now,
                        version: 1,
                    });
                    return this.saveMetadata(key, {
                        lastAccessed: now,
                        accessCount: 1,
                        createdAt: now,
                        version: 1,
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

    trackKeySet(key: OnyxKey): void {
        if (!this.isInitialized) return;

        const isEvictable = this.isKeyEvictable(key);
        const now = Date.now();
        const existing = this.keyInfoMap.get(key);

        if (existing) {
            this.updateExistingKey(existing, now, isEvictable);
        } else {
            this.createNewKeyInfo(key, now, isEvictable);
        }
    }

    private updateExistingKey(keyInfo: StorageKeyInfo, now: number, isEvictable: boolean): void {
        const updatedKeyInfo = {
            ...keyInfo,
            lastAccessed: now,
            accessCount: keyInfo.accessCount + 1,
            isEvictable,
        };

        this.keyInfoMap.set(keyInfo.key, updatedKeyInfo);

        if (isEvictable) {
            console.log(`[StorageManager] Updating metadata for key: ${updatedKeyInfo.key}`, {
                lastAccessed: now,
                accessCount: updatedKeyInfo.accessCount,
                createdAt: updatedKeyInfo.createdAt,
                version: 1,
            });
            this.saveMetadataAsync(updatedKeyInfo.key, {
                lastAccessed: now,
                accessCount: updatedKeyInfo.accessCount,
                createdAt: updatedKeyInfo.createdAt,
                version: 1,
            });
        }
    }

    private createNewKeyInfo(key: OnyxKey, now: number, isEvictable: boolean): void {
        const keyInfo = {
            key,
            lastAccessed: now,
            accessCount: 1,
            createdAt: now,
            isEvictable,
        };

        this.keyInfoMap.set(key, keyInfo);

        if (isEvictable) {
            console.log(`[StorageManager] Creating metadata for new key: ${key}`, {
                lastAccessed: now,
                accessCount: 1,
                createdAt: now,
                version: 1,
            });
            this.saveMetadataAsync(key, {
                lastAccessed: now,
                accessCount: 1,
                createdAt: now,
                version: 1,
            });
        }
    }

    private saveMetadataAsync(key: OnyxKey, metadata: StorageMetadata): void {
        this.saveMetadata(key, metadata).catch((error) => {
            Logger.logInfo(`Non-blocking metadata save failed for ${key}: ${error}`);
        });
    }

    trackKeyRemoval(key: OnyxKey): void {
        if (!this.isInitialized) return;

        this.keyInfoMap.delete(key);

        const removedKeyInfo = this.keyInfoMap.get(key);
        if (removedKeyInfo?.isEvictable) {
            const metadataKey = this.getMetadataKey(key);
            Storage.removeItem(metadataKey).catch((error) => {
                Logger.logInfo(`Failed to remove metadata for ${key}: ${error}`);
            });
        }
    }

    setEvictableKeys(keys: string[]): void {
        this.evictableKeys = new Set(keys);

        for (const keyInfo of this.keyInfoMap.values()) {
            const isEvictable = this.isKeyEvictable(keyInfo.key);
            keyInfo.isEvictable = isEvictable;
        }

        console.log(`[StorageManager] Updated evictable keys: ${this.getEvictableKeysCount()} evictable out of ${this.keyInfoMap.size} total`);
    }

    private isKeyEvictable(key: OnyxKey): boolean {
        return Array.from(this.evictableKeys).some((pattern) => {
            if (pattern.endsWith('_')) {
                return key.startsWith(pattern);
            }
            return key === pattern;
        });
    }

    private getEvictableKeysCount(): number {
        let count = 0;
        for (const keyInfo of this.keyInfoMap.values()) {
            if (keyInfo.isEvictable) {
                count++;
            }
        }
        return count;
    }

    private getMetadataKey(key: OnyxKey): string {
        return `__onyx_meta_${key}`;
    }

    private saveMetadata(key: OnyxKey, metadata: StorageMetadata): Promise<void | QueryResult<QueryResultRow>> {
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

    shouldPerformCleanup(): boolean {
        const now = Date.now();

        if (now - this.lastCleanup < this.config.cleanupInterval) {
            return false;
        }

        if (!this.config.enabled) {
            return false;
        }

        if (this.getEvictableKeysCount() === 0) {
            return false;
        }

        for (const keyInfo of this.keyInfoMap.values()) {
            if (keyInfo.isEvictable && this.isKeyExpired(keyInfo, now)) {
                Logger.logInfo('Found expired keys, cleanup needed');
                return true;
            }
        }

        return false;
    }

    private isKeyExpired(keyInfo: StorageKeyInfo, now: number): boolean {
        const daysSinceAccess = (now - keyInfo.lastAccessed) / MILLISECONDS_PER_DAY;
        const ageInDays = (now - keyInfo.createdAt) / MILLISECONDS_PER_DAY;

        return daysSinceAccess > this.config.maxIdleDays || ageInDays > this.config.maxAgeDays;
    }

    markCleanupPerformed(): void {
        this.lastCleanup = Date.now();
    }

    private startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;

        Logger.logInfo('Storage monitoring started');

        this.monitoringInterval = setInterval(() => {
            try {
                if (this.shouldPerformCleanup()) {
                    Logger.logInfo('Automatic cleanup triggered', {
                        evictableKeys: this.getEvictableKeysCount(),
                    });

                    this.performCleanup()
                        .then((result) => {
                            Logger.logInfo('Cleanup completed', {
                                cleanedKeys: result.cleanedKeys,
                                timeElapsed: `${result.timeElapsed}ms`,
                                errors: result.errors.length > 0 ? result.errors : 'None',
                            });
                        })
                        .catch((error) => {
                            Logger.logAlert(`Monitor cleanup failed: ${error}`);
                        });
                } else {
                    const now = Date.now();
                    if (!this.lastStatusLog || now - this.lastStatusLog > 5 * 60 * 1000) {
                        Logger.logInfo('Status check', {
                            totalKeys: this.keyInfoMap.size,
                            evictableKeys: this.getEvictableKeysCount(),
                        });
                        this.lastStatusLog = now;
                    }
                }
            } catch (error) {
                Logger.logInfo(`Storage monitoring error: ${error}`);
            }
        }, this.config.cleanupInterval);
    }

    private stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        Logger.logInfo('Storage monitoring stopped');
    }

    private performInitialCleanupIfNeeded(): Promise<StorageCleanupResult | void> {
        if (!this.shouldPerformCleanup()) {
            return Promise.resolve();
        }

        Logger.logInfo('Performing initial storage cleanup');
        return this.performCleanup();
    }

    shutdown(): void {
        this.stopMonitoring();
        this.isInitialized = false;
        Logger.logInfo('StorageManager shutdown completed');
    }

    performCleanup(): Promise<StorageCleanupResult> {
        if (!this.config.enabled) {
            return Promise.resolve({
                cleanedKeys: [],
                timeElapsed: 0,
                errors: ['Storage eviction is disabled'],
            });
        }

        const startTime = Date.now();
        const cleanedKeys: OnyxKey[] = [];
        const errors: string[] = [];

        Logger.logInfo('Starting storage cleanup');

        Logger.logInfo(`Storage usage: ${this.keyInfoMap.size} keys, ${this.getEvictableKeysCount()} evictable`);

        const keysToEvict: StorageKeyInfo[] = [];
        const now = Date.now();

        for (const keyInfo of this.keyInfoMap.values()) {
            if (keyInfo.isEvictable && this.shouldEvictKey(keyInfo)) {
                keysToEvict.push(keyInfo);
            }
        }

        console.log(`[StorageManager] Cleanup candidates found:`, {
            totalEvictable: this.getEvictableKeysCount(),
            keysToEvict: keysToEvict.map((k) => k.key),
            candidateData: keysToEvict.map((k) => ({
                key: k.key,
                lastAccessed: new Date(k.lastAccessed).toISOString(),
                ageInDays: Math.floor((now - k.createdAt) / MILLISECONDS_PER_DAY),
                idleDays: Math.floor((now - k.lastAccessed) / MILLISECONDS_PER_DAY),
                accessCount: k.accessCount,
            })),
        });

        Logger.logInfo(`Found ${keysToEvict.length} keys to evict`);

        if (keysToEvict.length === 0) {
            return Promise.resolve({
                cleanedKeys: [],
                timeElapsed: Date.now() - startTime,
                errors: ['No evictable keys found'],
            });
        }

        return this.executeCleanup(keysToEvict).then(({successfulKeys, failedKeys}) => {
            cleanedKeys.push(...successfulKeys);

            console.log(`[StorageManager] Cleanup completed:`, {
                successfulKeys,
                failedKeys,
                totalCleaned: successfulKeys.length,
                totalFailed: failedKeys.length,
                timeElapsed: `${Date.now() - startTime}ms`,
            });

            if (failedKeys.length > 0) {
                errors.push(`Failed to clean ${failedKeys.length} keys: ${failedKeys.join(', ')}`);
            }

            const successfulKeysSet = new Set(successfulKeys);
            for (const key of successfulKeysSet) {
                this.trackKeyRemoval(key);
            }

            this.markCleanupPerformed();

            Logger.logInfo(`Storage cleanup completed: cleaned ${cleanedKeys.length} keys`);

            return {
                cleanedKeys,
                timeElapsed: Date.now() - startTime,
                errors,
            };
        });
    }

    private shouldEvictKey(keyInfo: StorageKeyInfo): boolean {
        if (!this.config.enabled) return false;

        const now = Date.now();
        const daysSinceAccess = (now - keyInfo.lastAccessed) / MILLISECONDS_PER_DAY;
        const ageInDays = (now - keyInfo.createdAt) / MILLISECONDS_PER_DAY;

        // Check idle time (most common reason for eviction)
        if (daysSinceAccess > this.config.maxIdleDays) {
            return true;
        }

        // Check maximum age (evict old keys regardless of usage)
        if (ageInDays > this.config.maxAgeDays) {
            return true;
        }

        return false;
    }

    private executeCleanup(keysToEvict: StorageKeyInfo[]): Promise<{successfulKeys: OnyxKey[]; failedKeys: OnyxKey[]}> {
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

let storageManagerInstance: StorageManager | null = null;

function createStorageManager(config: StorageManagerConfig | false = {}): StorageManager | null {
    if (config === false) {
        return null;
    }

    if (storageManagerInstance) {
        storageManagerInstance.shutdown();
    }
    storageManagerInstance = new StorageManager(config);
    return storageManagerInstance;
}

function getStorageManager(): StorageManager | null {
    return storageManagerInstance;
}

function cleanupStorageManager(): void {
    if (!storageManagerInstance) {
        return;
    }
    storageManagerInstance.shutdown();
    storageManagerInstance = null;
}

export {StorageManager, createStorageManager, getStorageManager, cleanupStorageManager, DEFAULT_STORAGE_CONFIG};
