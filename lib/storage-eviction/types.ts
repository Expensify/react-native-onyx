import type {OnyxKey} from '../types';

interface StorageUsageConfig {
    enabled: boolean;
    accessTrackingEnabled: boolean;
    cleanupInterval: number;
    maxIdleDays: number; // Maximum days a key can remain unused before eviction
    maxAgeDays: number; // Maximum age of a key regardless of usage
    evictableKeys: string[]; // Keys or key patterns that can be evicted
}

interface StorageKeyInfo {
    key: OnyxKey;
    lastAccessed: number;
    accessCount: number;
    createdAt: number;
    isEvictable: boolean;
}

interface StorageMetadata {
    lastAccessed: number;
    accessCount: number;
    createdAt: number;
    version: number; // For future schema changes
}

const DEFAULT_STORAGE_CONFIG: StorageUsageConfig = {
    enabled: true, // Storage eviction is enabled by default
    accessTrackingEnabled: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    maxIdleDays: 7, // Evict keys unused for 7 days
    maxAgeDays: 30, // Evict keys older than 30 days regardless of usage
    evictableKeys: [],
};

export type {StorageUsageConfig, StorageKeyInfo, StorageMetadata};

export {DEFAULT_STORAGE_CONFIG};
