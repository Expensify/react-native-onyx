import type {OnyxKey} from '../types';

/**
 * Configuration options for storage usage monitoring and cleanup.
 * Controls when and how the storage manager performs automatic eviction.
 */
interface StorageUsageConfig {
    /** Whether storage monitoring and cleanup is enabled */
    enabled: boolean;

    /** Interval in milliseconds between cleanup checks */
    cleanupInterval: number;

    /** Maximum days a key can remain unused before being eligible for eviction */
    maxIdleDays: number;

    /** Maximum age of a key in days, regardless of usage, before being eligible for eviction */
    maxAgeDays: number;

    /** Array of key or collection keys that are eligible for eviction */
    evictableKeys: string[];
}

/**
 * Metadata information tracked for each storage key.
 * Used to determine eviction eligibility based on usage patterns.
 */
interface StorageKeyInfo {
    /** The Onyx key being tracked */
    key: OnyxKey;

    /** Timestamp (in milliseconds) when this key was last accessed */
    lastAccessed: number;

    /** Timestamp (in milliseconds) when this key was first created */
    createdAt: number;
}

/**
 * Persistent metadata stored alongside each key in storage.
 * This data is saved to storage and persists across app sessions.
 */
interface StorageMetadata {
    /** Timestamp (in milliseconds) when this key was last accessed */
    lastAccessed: number;

    /** Timestamp (in milliseconds) when this key was first created */
    createdAt: number;
}

/**
 * Default configuration for storage management.
 * These values provide sensible defaults for most applications.
 */
const DEFAULT_STORAGE_CONFIG: StorageUsageConfig = {
    /** Storage management is enabled by default */
    enabled: true,

    /** Check for cleanup every 5 minutes */
    cleanupInterval: 5 * 60 * 1000,

    /** Keys unused for 7 days are eligible for eviction */
    maxIdleDays: 7,

    /** Keys older than 30 days are eligible for eviction regardless of usage */
    maxAgeDays: 30,

    /** No keys are evictable by default - must be explicitly configured */
    evictableKeys: [],
};

/**
 * Represents the result of a storage cleanup operation.
 * @property cleanedKeys - An array of Onyx keys that were successfully cleaned/evicted.
 * @property timeElapsed - The time taken (in milliseconds) to perform the cleanup.
 * @property errors - An array of error messages encountered during the cleanup process.
 */
type StorageCleanupResult = {
    cleanedKeys: OnyxKey[];
    timeElapsed: number;
    errors: string[];
};

type CleanupExecutionResult = {
    successfulKeys: OnyxKey[];
    failedKeys: OnyxKey[];
};

export type {StorageUsageConfig, StorageKeyInfo, StorageMetadata, StorageCleanupResult, CleanupExecutionResult};

export {DEFAULT_STORAGE_CONFIG};
