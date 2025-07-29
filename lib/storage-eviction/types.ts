import type {OnyxKey} from '../types';

interface StorageUsageConfig {
    enabled: boolean;
    cleanupInterval: number;
    maxIdleDays: number; // Maximum days a key can remain unused before eviction
    maxAgeDays: number; // Maximum age of a key regardless of usage
    evictableKeys: string[]; // Keys or key patterns that can be evicted
}

interface StorageKeyInfo {
    key: OnyxKey;
    lastAccessed: number;
    createdAt: number;
}

interface StorageMetadata {
    lastAccessed: number;
    createdAt: number;
}

const DEFAULT_STORAGE_CONFIG: StorageUsageConfig = {
    enabled: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    maxIdleDays: 7,
    maxAgeDays: 30,
    evictableKeys: [],
};

export type {StorageUsageConfig, StorageKeyInfo, StorageMetadata};

export {DEFAULT_STORAGE_CONFIG};
