import {jest} from '@jest/globals';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import Storage from '../../lib/storage';
import {OnyxStorageManager} from '../../lib/OnyxStorageManager';
import * as CollectionKeyUtils from '../../lib/CollectionKeyUtils';
import type {StorageUsageConfig, StorageMetadata} from '../../lib/OnyxStorageManager/types';

// Mock the Storage module
const storageSetItemSpy = jest.spyOn(Storage, 'setItem').mockImplementation(() => Promise.resolve());
const storageGetItemSpy = jest.spyOn(Storage, 'getItem').mockImplementation(() => Promise.resolve(null));
const storageRemoveItemSpy = jest.spyOn(Storage, 'removeItem').mockImplementation(() => Promise.resolve());
const storageGetAllKeysSpy = jest.spyOn(Storage, 'getAllKeys').mockImplementation(() => Promise.resolve([]));

describe('Storage Eviction Tests', () => {
    let storageManager: OnyxStorageManager;
    const originalDateNow = Date.now;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Reset Date.now to current time
        Date.now = originalDateNow;

        // Create a fresh instance for each test
        storageManager = new OnyxStorageManager();
    });

    afterEach(() => {
        // Restore Date.now
        Date.now = originalDateNow;
    });

    describe('Metadata Creation', () => {
        it('should create metadata when key is accessed for the first time', async () => {
            // Test scenario 1: If there is no metadata key in storage it should be created when key was accessed

            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['test_key'],
                maxIdleDays: 7,
                maxAgeDays: 30,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Mock that the key exists in storage but no metadata
            storageGetAllKeysSpy.mockResolvedValue(['test_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_test_key') {
                    return Promise.resolve(null); // No metadata exists
                }
                return Promise.resolve('some_value'); // Key has value
            });

            // Initialize the storage manager
            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Verify metadata was created for the evictable key
            expect(storageSetItemSpy).toHaveBeenCalledWith(
                '__onyx_meta_test_key',
                expect.objectContaining({
                    lastAccessed: expect.any(Number),
                    createdAt: expect.any(Number),
                }),
            );
        });

        it('should track key access and update metadata', async () => {
            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['test_key'],
                maxIdleDays: 7,
                maxAgeDays: 30,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Initialize with existing metadata
            const existingMetadata: StorageMetadata = {
                lastAccessed: Date.now() - 1000,
                createdAt: Date.now() - 10000,
            };

            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_test_key') {
                    return Promise.resolve(existingMetadata);
                }
                return Promise.resolve(null);
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Track a key access
            const accessTime = Date.now();
            Date.now = jest.fn(() => accessTime);

            storageManager.trackKeySet('test_key');
            await waitForPromisesToResolve();

            // Verify metadata was updated with new access
            expect(storageSetItemSpy).toHaveBeenCalledWith(
                '__onyx_meta_test_key',
                expect.objectContaining({
                    lastAccessed: accessTime,
                    createdAt: existingMetadata.createdAt, // Should remain same
                }),
            );
        });
    });

    describe('Automatic Cleanup - Idle Time', () => {
        it('should automatically clean up items unused longer than maxIdleDays', async () => {
            // Test scenario 2: If the item in storage is unused for a longer time than set in the config it should be automatically cleaned up

            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['old_key'],
                maxIdleDays: 7, // 7 days
                maxAgeDays: 30,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Create metadata for a key that hasn't been accessed for 10 days (> 7 days)
            const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
            const oldMetadata: StorageMetadata = {
                lastAccessed: tenDaysAgo,
                createdAt: tenDaysAgo,
            };

            storageGetAllKeysSpy.mockResolvedValue(['old_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_old_key') {
                    return Promise.resolve(oldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify the old key was removed
            expect(result.cleanedKeys).toContain('old_key');
            expect(storageRemoveItemSpy).toHaveBeenCalledWith('old_key');
        });

        it('should not clean up recently accessed items', async () => {
            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['recent_key'],
                maxIdleDays: 7,
                maxAgeDays: 30,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Create metadata for a key accessed 3 days ago (< 7 days)
            const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
            const recentMetadata: StorageMetadata = {
                lastAccessed: threeDaysAgo,
                createdAt: threeDaysAgo,
            };

            storageGetAllKeysSpy.mockResolvedValue(['recent_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_recent_key') {
                    return Promise.resolve(recentMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify the recent key was NOT removed
            expect(result.cleanedKeys).not.toContain('recent_key');
            expect(storageRemoveItemSpy).not.toHaveBeenCalledWith('recent_key');
        });
    });

    describe('Automatic Cleanup - Age', () => {
        it('should automatically clean up items older than maxAgeDays regardless of access', async () => {
            // Test scenario 3: When the item is longer in storage than provided in the config it should be removed automatically

            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['very_old_key'],
                maxIdleDays: 7,
                maxAgeDays: 30, // 30 days max age
                cleanupInterval: 5 * 60 * 1000,
            };

            // Create metadata for a key that's 40 days old (> 30 days) but accessed recently
            const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
            const yesterday = Date.now() - 1 * 24 * 60 * 60 * 1000;

            const veryOldMetadata: StorageMetadata = {
                lastAccessed: yesterday, // Accessed recently
                createdAt: fortyDaysAgo, // But created 40 days ago
            };

            storageGetAllKeysSpy.mockResolvedValue(['very_old_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_very_old_key') {
                    return Promise.resolve(veryOldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify the old key was removed despite recent access
            expect(result.cleanedKeys).toContain('very_old_key');
            expect(storageRemoveItemSpy).toHaveBeenCalledWith('very_old_key');
        });

        it('should not clean up new items regardless of access frequency', async () => {
            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['new_key'],
                maxIdleDays: 7,
                maxAgeDays: 30,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Create metadata for a new key (< 30 days old)
            const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
            const newMetadata: StorageMetadata = {
                lastAccessed: fiveDaysAgo,
                createdAt: fiveDaysAgo, // But recently created
            };

            storageGetAllKeysSpy.mockResolvedValue(['new_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_new_key') {
                    return Promise.resolve(newMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify the new key was NOT removed
            expect(result.cleanedKeys).not.toContain('new_key');
            expect(storageRemoveItemSpy).not.toHaveBeenCalledWith('new_key');
        });
    });

    describe('Evictable Keys Filter', () => {
        it('should only remove items which keys are added to evictableKeys', async () => {
            // Test scenario 4: Only remove items which keys are added to evictableKeys

            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['evictable_key'], // Only this key is evictable
                maxIdleDays: 1, // Very short time to trigger eviction
                maxAgeDays: 1,
                cleanupInterval: 5 * 60 * 1000,
            };

            // Create old metadata for both evictable and non-evictable keys
            const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
            const oldMetadata: StorageMetadata = {
                lastAccessed: oldTime,
                createdAt: oldTime,
            };

            storageGetAllKeysSpy.mockResolvedValue(['evictable_key', 'protected_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_evictable_key' || key === '__onyx_meta_protected_key') {
                    return Promise.resolve(oldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify only the evictable key was removed
            expect(result.cleanedKeys).toContain('evictable_key');
            expect(result.cleanedKeys).not.toContain('protected_key');
            expect(storageRemoveItemSpy).toHaveBeenCalledWith('evictable_key');
            expect(storageRemoveItemSpy).not.toHaveBeenCalledWith('protected_key');
        });

        it('should support key patterns with underscore suffix', async () => {
            CollectionKeyUtils.setCollectionKeys(new Set(['temp_']));

            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: ['temp_'], // Pattern: keys starting with 'temp_'
                maxIdleDays: 1,
                maxAgeDays: 1,
                cleanupInterval: 5 * 60 * 1000,
            };

            const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
            const oldMetadata: StorageMetadata = {
                lastAccessed: oldTime,
                createdAt: oldTime,
            };

            storageGetAllKeysSpy.mockResolvedValue(['temp_file1', 'temp_file2', 'permanent_file']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key.startsWith('__onyx_meta_')) {
                    return Promise.resolve(oldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify only temp_ prefixed keys were removed
            expect(result.cleanedKeys).toContain('temp_file1');
            expect(result.cleanedKeys).toContain('temp_file2');
            expect(result.cleanedKeys).not.toContain('permanent_file');
        });

        it('should not evict anything when evictableKeys is empty', async () => {
            const config: StorageUsageConfig = {
                enabled: true,
                evictableKeys: [], // No keys are evictable
                maxIdleDays: 1,
                maxAgeDays: 1,
                cleanupInterval: 5 * 60 * 1000,
            };

            const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
            const oldMetadata: StorageMetadata = {
                lastAccessed: oldTime,
                createdAt: oldTime,
            };

            storageGetAllKeysSpy.mockResolvedValue(['some_key', 'another_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key.startsWith('__onyx_meta_')) {
                    return Promise.resolve(oldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify no keys were removed
            expect(result.cleanedKeys).toHaveLength(0);
            expect(storageRemoveItemSpy).not.toHaveBeenCalled();
        });
    });

    describe('Disabled Eviction', () => {
        it('should not perform any cleanup when storage eviction is disabled', async () => {
            const config: StorageUsageConfig = {
                enabled: false, // Disabled
                evictableKeys: ['test_key'],
                maxIdleDays: 1,
                maxAgeDays: 1,
                cleanupInterval: 5 * 60 * 1000,
            };

            const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
            const oldMetadata: StorageMetadata = {
                lastAccessed: oldTime,
                createdAt: oldTime,
            };

            storageGetAllKeysSpy.mockResolvedValue(['test_key']);
            storageGetItemSpy.mockImplementation((key) => {
                if (key === '__onyx_meta_test_key') {
                    return Promise.resolve(oldMetadata);
                }
                return Promise.resolve('some_value');
            });

            await storageManager.initialize(config);
            await waitForPromisesToResolve();

            // Perform cleanup
            const result = await storageManager.performCleanup();

            // Verify no cleanup was performed
            expect(result.errors).toContain('Storage eviction is disabled');
            expect(result.cleanedKeys).toHaveLength(0);
            expect(storageRemoveItemSpy).not.toHaveBeenCalled();
        });
    });
});
