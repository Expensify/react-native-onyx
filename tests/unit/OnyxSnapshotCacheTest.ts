import type {OnyxKey} from '../../lib';
import {OnyxSnapshotCache} from '../../lib/OnyxSnapshotCache';
import OnyxUtils from '../../lib/OnyxUtils';
import type {UseOnyxOptions, UseOnyxResult, UseOnyxSelector} from '../../lib/useOnyx';

// Mock OnyxUtils for testing
jest.mock('../../lib/OnyxUtils', () => ({
    isCollectionKey: jest.fn(),
    getCollectionKey: jest.fn(),
}));

const mockedOnyxUtils = OnyxUtils as jest.Mocked<typeof OnyxUtils>;

// Test types
type TestData = {
    data: string;
    id?: string;
    name?: string;
};

type TestResult = UseOnyxResult<{data: string}>;

type TestSelector = UseOnyxSelector<OnyxKey, string>;

describe('OnyxSnapshotCache', () => {
    let cache: OnyxSnapshotCache;

    beforeEach(() => {
        cache = new OnyxSnapshotCache();
        jest.clearAllMocks();
    });

    describe('basic cache operations', () => {
        it('should generate unique cache keys for different options', () => {
            const selector: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.name ?? '';
            };
            const optionsWithSelector: UseOnyxOptions<OnyxKey, string> = {
                selector,
                initWithStoredValues: true,
                allowStaleData: false,
            };
            const optionsWithoutSelector: UseOnyxOptions<OnyxKey, string> = {
                initWithStoredValues: false,
                allowStaleData: true,
            };
            const keyWithSelector = cache.registerConsumer(optionsWithSelector);
            const keyWithoutSelector = cache.registerConsumer(optionsWithoutSelector);
            const keyWithUndefined = cache.registerConsumer({});

            // Different option combinations should produce different cache keys
            expect(keyWithSelector).toContain('0_'); // Should contain selector ID
            expect(keyWithoutSelector).toContain('no_selector'); // Should indicate no selector
            expect(keyWithUndefined).toContain('no_selector'); // Should indicate no selector

            // All keys should be unique
            expect(new Set([keyWithSelector, keyWithoutSelector, keyWithUndefined]).size).toBe(3);
        });

        it('should store and retrieve cached results', () => {
            const key = 'testKey';
            const cacheKey = 'testCacheKey';
            const result: TestResult = [{data: 'test'}, {status: 'loaded'}];

            cache.setCachedResult<TestResult>(key, cacheKey, result);
            const retrieved = cache.getCachedResult<TestResult>(key, cacheKey);

            expect(retrieved).toEqual(result);
        });

        it('should return undefined for non-existent cache entries', () => {
            const result = cache.getCachedResult<TestResult>('nonExistentKey', 'nonExistentCacheKey');
            expect(result).toBeUndefined();
        });

        it('should clear all caches', () => {
            const result1: TestResult = [{data: 'test1'}, {status: 'loaded'}];
            const result2: TestResult = [{data: 'test2'}, {status: 'loaded'}];

            cache.setCachedResult<TestResult>('key1', 'cacheKey1', result1);
            cache.setCachedResult<TestResult>('key2', 'cacheKey2', result2);

            cache.clear();

            expect(cache.getCachedResult<TestResult>('key1', 'cacheKey1')).toBeUndefined();
            expect(cache.getCachedResult<TestResult>('key2', 'cacheKey2')).toBeUndefined();
        });
    });

    describe('selector ID management', () => {
        it('should generate unique IDs for different selectors', () => {
            const nameSelector: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.name ?? '';
            };
            const idSelector: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.id ?? '';
            };

            const nameId = cache.getSelectorID(nameSelector);
            const idSelectorId = cache.getSelectorID(idSelector);

            // Different selectors should get different IDs
            expect(nameId).not.toBe(idSelectorId);
        });

        it('should return the same ID for the same selector function', () => {
            const selector: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.name ?? '';
            };

            const firstCall = cache.getSelectorID(selector);
            const secondCall = cache.getSelectorID(selector);
            const thirdCall = cache.getSelectorID(selector);

            // Multiple calls with same selector should return identical ID
            expect(firstCall).toBe(secondCall);
            expect(secondCall).toBe(thirdCall);
        });

        it('should clear selector IDs and reset counter', () => {
            const selector1: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.name ?? '';
            };
            const selector2: TestSelector = (data) => {
                const testData = data as TestData | undefined;
                return testData?.id ?? '';
            };

            // Clear the selector IDs
            cache.clearSelectorIds();

            // After clearing, selectors should get new IDs starting from 0
            const id1After = cache.getSelectorID(selector1);
            const id2After = cache.getSelectorID(selector2);

            expect(id1After).toBe(0); // First selector after clear should get ID 0
            expect(id2After).toBe(1); // Second selector should get ID 1
        });
    });

    describe('cache invalidation', () => {
        beforeEach(() => {
            // Set up cache with multiple entries
            cache.setCachedResult<TestResult>('reports_', 'cache1', [{data: 'collection'}, {status: 'loaded'}]);
            cache.setCachedResult<TestResult>('reports_123', 'cache2', [{data: 'member1'}, {status: 'loaded'}]);
            cache.setCachedResult<TestResult>('reports_456', 'cache3', [{data: 'member2'}, {status: 'loaded'}]);
            cache.setCachedResult<TestResult>('users_', 'cache4', [{data: 'users collection'}, {status: 'loaded'}]);
            cache.setCachedResult<TestResult>('users_789', 'cache5', [{data: 'user member'}, {status: 'loaded'}]);
            cache.setCachedResult<TestResult>('nonCollectionKey', 'cache6', [{data: 'regular key'}, {status: 'loaded'}]);
        });

        it('should invalidate non-collection keys without affecting others', () => {
            mockedOnyxUtils.isCollectionKey.mockReturnValue(false);
            mockedOnyxUtils.getCollectionKey.mockReturnValue(undefined);

            cache.invalidateForKey('nonCollectionKey');

            // Non-collection key should be invalidated
            expect(cache.getCachedResult<TestResult>('nonCollectionKey', 'cache6')).toBeUndefined();

            // All other keys should remain
            expect(cache.getCachedResult<TestResult>('reports_', 'cache1')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('reports_123', 'cache2')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('reports_456', 'cache3')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('users_', 'cache4')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('users_789', 'cache5')).toBeDefined();
        });

        it('should invalidate collection member key and its base collection only', () => {
            mockedOnyxUtils.isCollectionKey.mockReturnValue(true);
            mockedOnyxUtils.getCollectionKey.mockReturnValue('reports_');

            cache.invalidateForKey('reports_123');

            // Collection member and base should be invalidated
            expect(cache.getCachedResult<TestResult>('reports_123', 'cache2')).toBeUndefined();
            expect(cache.getCachedResult<TestResult>('reports_', 'cache1')).toBeUndefined();

            // Other collection members should remain (selective invalidation)
            expect(cache.getCachedResult<TestResult>('reports_456', 'cache3')).toBeDefined();

            // Unrelated keys should remain
            expect(cache.getCachedResult<TestResult>('users_', 'cache4')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('users_789', 'cache5')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('nonCollectionKey', 'cache6')).toBeDefined();
        });

        it('should invalidate collection base key without cascading to members', () => {
            mockedOnyxUtils.isCollectionKey.mockReturnValue(true);
            mockedOnyxUtils.getCollectionKey.mockReturnValue('reports_');

            // When base key equals the key to invalidate, it's a collection base key
            cache.invalidateForKey('reports_');

            // Only the base collection should be invalidated
            expect(cache.getCachedResult<TestResult>('reports_', 'cache1')).toBeUndefined();

            // Collection members should remain (no cascade deletion)
            expect(cache.getCachedResult<TestResult>('reports_123', 'cache2')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('reports_456', 'cache3')).toBeDefined();

            // Unrelated keys should remain
            expect(cache.getCachedResult<TestResult>('users_', 'cache4')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('users_789', 'cache5')).toBeDefined();
            expect(cache.getCachedResult<TestResult>('nonCollectionKey', 'cache6')).toBeDefined();
        });

        it('should handle multiple different collection keys independently', () => {
            // Invalidate reports collection member
            mockedOnyxUtils.isCollectionKey.mockReturnValueOnce(true);
            mockedOnyxUtils.getCollectionKey.mockReturnValueOnce('reports_');
            cache.invalidateForKey('reports_123');

            // Invalidate users collection member
            mockedOnyxUtils.isCollectionKey.mockReturnValueOnce(true);
            mockedOnyxUtils.getCollectionKey.mockReturnValueOnce('users_');
            cache.invalidateForKey('users_789');

            // Reports: member and base should be invalidated
            expect(cache.getCachedResult<TestResult>('reports_123', 'cache2')).toBeUndefined();
            expect(cache.getCachedResult<TestResult>('reports_', 'cache1')).toBeUndefined();

            // Users: member and base should be invalidated
            expect(cache.getCachedResult<TestResult>('users_789', 'cache5')).toBeUndefined();
            expect(cache.getCachedResult<TestResult>('users_', 'cache4')).toBeUndefined();

            // Other collection members should remain
            expect(cache.getCachedResult<TestResult>('reports_456', 'cache3')).toBeDefined();

            // Non-collection keys should remain
            expect(cache.getCachedResult<TestResult>('nonCollectionKey', 'cache6')).toBeDefined();
        });
    });
});
