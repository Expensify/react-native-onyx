import type OnyxInstance from '../../lib/Onyx';
import type OnyxCache from '../../lib/OnyxCache';
import type {CacheTask} from '../../lib/OnyxCache';
import type {Connection} from '../../lib/OnyxConnectionManager';
import type MockedStorage from '../../lib/storage/__mocks__';
import type {InitOptions} from '../../lib/types';
import generateRange from '../utils/generateRange';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const MOCK_TASK = 'mockTask' as CacheTask;

describe('Onyx', () => {
    describe('Cache Service', () => {
        /** @type OnyxCache */
        let cache: typeof OnyxCache;

        // Always use a "fresh" instance
        beforeEach(() => {
            jest.resetModules();
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            cache = require('../../lib/OnyxCache').default;
        });

        describe('getAllKeys', () => {
            it('Should be empty initially', () => {
                // Given empty cache

                // When all keys are retrieved
                const allKeys = cache.getAllKeys();

                // Then the result should be empty
                expect(allKeys).toEqual(new Set());
            });

            it('Should keep storage keys', () => {
                // Given cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3']));
            });

            it('Should keep storage keys even when no values are provided', () => {
                // Given cache with some items
                cache.set('mockKey', undefined);
                cache.set('mockKey2', undefined);
                cache.set('mockKey3', undefined);

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3']));
            });

            it('Should not store duplicate keys', () => {
                // Given cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // When an existing keys is later updated
                cache.set('mockKey2', 'new mock value');

                // Then getAllKeys should not include a duplicate value
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3']));
            });
        });

        describe('getValue', () => {
            it('Should return undefined when there is no stored value', () => {
                // Given empty cache

                // When a value is retrieved
                const result = cache.get('mockKey');

                // Then it should be undefined
                expect(result).not.toBeDefined();
            });

            it('Should return cached value when it exists', () => {
                // Given cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // When a value is retrieved
                // Then it should be the correct value
                expect(cache.get('mockKey')).toEqual({items: ['mockValue', 'mockValue2']});
                expect(cache.get('mockKey2')).toEqual('mockValue3');
            });
        });

        describe('hasCacheForKey', () => {
            it('Should return false when there is no stored value', () => {
                // Given empty cache

                // When a value does not exist in cache
                // Then it should return false
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
            });

            it('Should return true when cached value exists', () => {
                // Given cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // When a value exists in cache
                // Then it should return true
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.hasCacheForKey('mockKey2')).toBe(true);
            });
        });

        describe('addKey', () => {
            it('Should store the key so that it is returned by `getAllKeys`', () => {
                // Given empty cache

                // When set is called with key and value
                cache.addKey('mockKey');

                // Then there should be no cached value
                expect(cache.hasCacheForKey('mockKey')).toBe(false);

                // Then but a key should be available
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey']));
            });

            it('Should not make duplicate keys', () => {
                // Given empty cache

                // When the same item is added multiple times
                cache.addKey('mockKey');
                cache.addKey('mockKey');
                cache.addKey('mockKey2');
                cache.addKey('mockKey');

                // Then getAllKeys should not include a duplicate value
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2']));
            });
        });

        describe('set', () => {
            it('Should add data to cache when both key and value are provided', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then data should be cached
                const data = cache.get('mockKey');
                expect(data).toEqual({value: 'mockValue'});
            });

            it('Should store the key so that it is returned by `getAllKeys`', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then but a key should be available
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey']));
            });

            it('Should overwrite existing cache items for the Given key', () => {
                // Given cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue'});

                // When set is called for an existing key
                cache.set('mockKey2', {value: []});

                // Then the value should be overwritten
                expect(cache.get('mockKey2')).toEqual({value: []});
            });
        });

        describe('drop', () => {
            it('Should remove the key from cache', () => {
                // Given cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // When a key is removed
                cache.drop('mockKey');

                // Then a value should not be available in cache
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
                expect(cache.get('mockKey')).not.toBeDefined();
                expect(cache.getAllKeys().has('mockKey')).toBe(false);
            });
        });

        describe('merge', () => {
            it('Should create the value in cache when it does not exist', () => {
                // Given empty cache

                // When merge is called with new key value pairs
                cache.merge({
                    mockKey: {value: 'mockValue'},
                    mockKey2: {value: 'mockValue2'},
                });

                // Then data should be created in cache
                expect(cache.get('mockKey')).toEqual({value: 'mockValue'});
                expect(cache.get('mockKey2')).toEqual({value: 'mockValue2'});
            });

            it('Should merge data to existing cache value', () => {
                // Given cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue', mock: 'mock', items: [3, 4, 5]});

                // When merge is called with existing key value pairs
                cache.merge({
                    mockKey: {mockItems: []},
                    mockKey2: {items: [1, 2], other: 'overwrittenMockValue'},
                });

                // Then the values should be merged together in cache
                expect(cache.get('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                });

                expect(cache.get('mockKey2')).toEqual({
                    other: 'overwrittenMockValue',
                    items: [1, 2],
                    mock: 'mock',
                });
            });

            it('Should merge objects correctly', () => {
                // Given cache with existing object data
                cache.set('mockKey', {value: 'mockValue', otherValue: 'overwrite me'});

                // When merge is called for a key with object value
                cache.merge({
                    mockKey: {mockItems: [], otherValue: 'overwritten'},
                });

                // Then the values should be merged together in cache
                expect(cache.get('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                    otherValue: 'overwritten',
                });
            });

            it('Should merge arrays correctly', () => {
                // Given cache with existing array data
                cache.set('mockKey', [{ID: 1}, {ID: 2}, {ID: 3}]);

                // When merge is called with an array
                cache.merge({
                    mockKey: [{ID: 3}, {added: 'field'}, {}, {ID: 1000}],
                });

                // Then the arrays should be replaced as expected
                expect(cache.get('mockKey')).toEqual([{ID: 3}, {added: 'field'}, {}, {ID: 1000}]);
            });

            it('Should merge arrays inside objects correctly', () => {
                // Given cache with existing array data
                cache.set('mockKey', {ID: [1]});

                // When merge is called with an array
                cache.merge({
                    mockKey: {ID: [2]},
                });

                // Then the first array is completely replaced by the second array
                expect(cache.get('mockKey')).toEqual({ID: [2]});
            });

            it('Should work with primitive values', () => {
                // Given cache with existing data
                cache.set('mockKey', {});

                // When merge is called with bool
                cache.merge({mockKey: false});

                // Then the object should be overwritten with a bool value
                expect(cache.get('mockKey')).toEqual(false);

                // When merge is called with number
                cache.merge({mockKey: 0});

                // Then the value should be overwritten
                expect(cache.get('mockKey')).toEqual(0);

                // When merge is called with string
                cache.merge({mockKey: '123'});

                // Then the value should be overwritten
                expect(cache.get('mockKey')).toEqual('123');

                // When merge is called with string again
                cache.merge({mockKey: '123'});

                // Then strings should not have been concatenated
                expect(cache.get('mockKey')).toEqual('123');

                // When merge is called with an object
                cache.merge({mockKey: {value: 'myMockObject'}});

                // Then the old primitive value should be overwritten with the object
                expect(cache.get('mockKey')).toEqual({value: 'myMockObject'});
            });

            it('Should ignore `undefined` values', () => {
                // Given cache with existing data
                cache.set('mockKey', {ID: 5});

                // When merge is called key value pair and the value is undefined
                cache.merge({mockKey: {ID: undefined}});

                // Then the key should still be in cache and the value unchanged
                expect(cache.get('mockKey')).toEqual({ID: 5});

                cache.merge({mockKey: undefined});

                // Then the key should still be in cache and the value unchanged
                expect(cache.get('mockKey')).toEqual({ID: 5});
            });

            it('Should update storageKeys when new keys are created', () => {
                // Given cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue', mock: 'mock', items: [3, 4, 5]});

                // When merge is called with existing key value pairs
                cache.merge({
                    mockKey: {mockItems: []},
                    mockKey3: {ID: 3},
                    mockKey4: {ID: 4},
                });

                // Then getAllStorage keys should return updated storage keys
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3', 'mockKey4']));
            });

            it('Should throw if called with anything that is not an object', () => {
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge([])).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge('')).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge(0)).toThrow();
                expect(() => cache.merge({})).not.toThrow();
            });

            it('Should remove `null` values when merging', () => {
                cache.set('mockKey', {ID: 5});
                cache.set('mockNullKey', null);

                cache.merge({mockKey: null});

                expect(cache.get('mockKey')).toEqual(undefined);
                expect(cache.get('mockNullKey')).toEqual(undefined);
            });
        });

        describe('hasPendingTask', () => {
            it('Should return false when there is no started task', () => {
                // Given empty cache with no started tasks
                // When a task has not been started
                // Then it should return false
                expect(cache.hasPendingTask(MOCK_TASK)).toBe(false);
            });

            it('Should return true when a task is running', () => {
                // Given empty cache with no started tasks
                // When a unique task is started
                const promise = Promise.resolve();
                cache.captureTask(MOCK_TASK, promise);

                // Then `hasPendingTask` should return true
                expect(cache.hasPendingTask(MOCK_TASK)).toBe(true);

                // When the promise is completed
                return waitForPromisesToResolve().then(() => {
                    // Then `hasPendingTask` should return false
                    expect(cache.hasPendingTask(MOCK_TASK)).toBe(false);
                });
            });
        });

        describe('getTaskPromise', () => {
            it('Should return undefined when there is no stored value', () => {
                // Given empty cache with no started tasks

                // When a task is retrieved
                const task = cache.getTaskPromise(MOCK_TASK);

                // Then it should be undefined
                expect(task).not.toBeDefined();
            });

            it('Should return captured task when it exists', () => {
                // Given empty cache with no started tasks
                // When a unique task is started
                const promise = Promise.resolve({mockResult: true});
                cache.captureTask(MOCK_TASK, promise);

                // When a task is retrieved
                const taskPromise = cache.getTaskPromise(MOCK_TASK);

                // Then it should resolve with the same result as the captured task
                return taskPromise!.then((result) => {
                    expect(result).toEqual({mockResult: true});
                });
            });
        });

        describe.only('getCollectionData', () => {
            const COLLECTION_KEY = 'test_collection_';
            const MEMBER_KEY_1 = `${COLLECTION_KEY}member1`;
            const MEMBER_KEY_2 = `${COLLECTION_KEY}member2`;
            const MEMBER_KEY_3 = `${COLLECTION_KEY}member3`;

            beforeEach(() => {
                cache.setCollectionKeys(new Set([COLLECTION_KEY]));
            });

            it('Should return undefined when collection does not exist', () => {
                // When getCollectionData is called for non-existent collection
                const result = cache.getCollectionData('non_existent_collection_');

                // Then it should return undefined
                expect(result).toBeUndefined();
            });

            it('Should return undefined when collection is empty', () => {
                // Given a collection key is set but has no members
                cache.setCollectionKeys(new Set([COLLECTION_KEY]));

                // When getCollectionData is called
                const result = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return undefined
                expect(result).toBeUndefined();
            });

            it('Should return new reference when collection is dirty', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called (collection is dirty after set)
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference with all members
                expect(result1).toBeDefined();
                expect(result1).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_2]: {id: 2, value: 'test2'},
                });
            });

            it('Should return stable reference when collection is not dirty', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time (marks as clean)
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When getCollectionData is called again (not dirty)
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return the same reference
                expect(result1).toBe(result2);
                expect(result1).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_2]: {id: 2, value: 'test2'},
                });
            });

            it('Should return new reference after collection member is added', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When a new member is added
                cache.set(MEMBER_KEY_3, {id: 3, value: 'test3'});

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference with the new member
                expect(result1).not.toBe(result2);
                expect(result2).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_2]: {id: 2, value: 'test2'},
                    [MEMBER_KEY_3]: {id: 3, value: 'test3'},
                });
            });

            it('Should return new reference after collection member is updated', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When a member is updated
                cache.set(MEMBER_KEY_1, {id: 1, value: 'updated'});

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference with updated member
                expect(result1).not.toBe(result2);
                expect(result2).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'updated'},
                    [MEMBER_KEY_2]: {id: 2, value: 'test2'},
                });
            });

            it('Should return new reference after collection member is deleted', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});
                cache.set(MEMBER_KEY_3, {id: 3, value: 'test3'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When a member is deleted
                cache.set(MEMBER_KEY_2, null);

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference without the deleted member
                expect(result1).not.toBe(result2);
                expect(result2).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_3]: {id: 3, value: 'test3'},
                });
            });

            it('Should return undefined after all collection members are deleted', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);
                expect(result1).toBeDefined();

                // When all members are deleted
                cache.set(MEMBER_KEY_1, null);
                cache.set(MEMBER_KEY_2, null);

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return undefined
                expect(result2).toBeUndefined();
            });

            it('Should return undefined after collection is dropped', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);
                expect(result1).toBeDefined();

                // When collection is dropped
                cache.drop(COLLECTION_KEY);

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return undefined
                expect(result2).toBeUndefined();
            });

            it('Should return correct data structure with all collection members', () => {
                // Given a collection with multiple members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});
                cache.set(MEMBER_KEY_3, {id: 3, value: 'test3'});

                // When getCollectionData is called
                const result = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return an object with all members
                expect(result).toBeDefined();
                expect(Object.keys(result!)).toHaveLength(3);
                expect(result![MEMBER_KEY_1]).toEqual({id: 1, value: 'test1'});
                expect(result![MEMBER_KEY_2]).toEqual({id: 2, value: 'test2'});
                expect(result![MEMBER_KEY_3]).toEqual({id: 3, value: 'test3'});
            });

            it('Should maintain stable reference across multiple calls when no changes occur', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called multiple times without changes
                const result1 = cache.getCollectionData(COLLECTION_KEY);
                const result2 = cache.getCollectionData(COLLECTION_KEY);
                const result3 = cache.getCollectionData(COLLECTION_KEY);

                // Then all results should be the same reference
                expect(result1).toBe(result2);
                expect(result2).toBe(result3);
            });

            it('Should handle merge operations correctly', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When merge is called with new member
                cache.merge({
                    [MEMBER_KEY_3]: {id: 3, value: 'test3'},
                });

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference with merged data
                expect(result1).not.toBe(result2);
                expect(result2).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_2]: {id: 2, value: 'test2'},
                    [MEMBER_KEY_3]: {id: 3, value: 'test3'},
                });
            });

            it('Should return new reference after collection member is dropped', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});
                cache.set(MEMBER_KEY_3, {id: 3, value: 'test3'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);

                // When a member is dropped
                cache.drop(MEMBER_KEY_2);

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);

                // Then it should return a new reference without the dropped member
                expect(result1).not.toBe(result2);
                expect(result2).toEqual({
                    [MEMBER_KEY_1]: {id: 1, value: 'test1'},
                    [MEMBER_KEY_3]: {id: 3, value: 'test3'},
                });
            });

            it.only('Should return new reference after collection member is evicted via removeLeastRecentlyUsedKeys', () => {
                // Given a collection with some members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});
                cache.set(MEMBER_KEY_3, {id: 3, value: 'test3'});
                // Set eviction allow list to allow all keys to be evicted when removeLeastRecentlyUsedKeys is called
                cache.setEvictionAllowList([MEMBER_KEY_1, MEMBER_KEY_2, MEMBER_KEY_3]);

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);
                expect(result1).toBeDefined();
                expect(Object.keys(result1!)).toHaveLength(3);

                // When removeLeastRecentlyUsedKeys is called to evict collection members
                // Add keys in order - first added will be least recent
                cache.addToAccessedKeys(MEMBER_KEY_1);
                cache.addToAccessedKeys(MEMBER_KEY_2);
                cache.addToAccessedKeys(MEMBER_KEY_3);
                // MEMBER_KEY_3 is most recent, so MEMBER_KEY_1 and MEMBER_KEY_2 should be evicted
                cache.removeLeastRecentlyUsedKeys();

                // When getCollectionData is called again
                const result2 = cache.getCollectionData(COLLECTION_KEY);
                // Then it should return a new reference (collection is dirty after member eviction)
                expect(result1).not.toBe(result2);
                // Only the most recent member should remain
                expect(Object.keys(result2!)).toHaveLength(1);
                expect(result2![MEMBER_KEY_3]).toEqual({id: 3, value: 'test3'});
            });

            it('Should mark collection as dirty when setCollectionKeys is called with new collection', () => {
                // Given an existing collection with members
                cache.set(MEMBER_KEY_1, {id: 1, value: 'test1'});
                cache.set(MEMBER_KEY_2, {id: 2, value: 'test2'});

                // When getCollectionData is called first time
                const result1 = cache.getCollectionData(COLLECTION_KEY);
                expect(result1).toBeDefined();

                // When a new collection key is added via setCollectionKeys
                const NEW_COLLECTION_KEY = 'new_collection_';
                cache.setCollectionKeys(new Set([COLLECTION_KEY, NEW_COLLECTION_KEY]));

                // When getCollectionData is called for the new collection (should be dirty)
                const newCollectionResult = cache.getCollectionData(NEW_COLLECTION_KEY);

                // Then it should return undefined (empty collection)
                expect(newCollectionResult).toBeUndefined();

                // And the original collection should still work
                const result2 = cache.getCollectionData(COLLECTION_KEY);
                expect(result2).toBe(result1); // Same reference, not dirty
            });
        });
    });

    describe('Onyx with Cache', () => {
        let Onyx: typeof OnyxInstance;
        let StorageMock: typeof MockedStorage;

        /** @type OnyxCache */
        let cache: typeof OnyxCache;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            OTHER_TEST: 'otherTest',
            COLLECTION: {
                MOCK_COLLECTION: 'mock_collection_',
            },
        };

        function initOnyx(overrides?: Partial<InitOptions>) {
            Onyx.init({
                keys: ONYX_KEYS,
                evictableKeys: [ONYX_KEYS.COLLECTION.MOCK_COLLECTION],
                maxCachedKeysCount: 10,
                ...overrides,
            });

            // Onyx init introduces some side effects e.g. calls the getAllKeys
            // We're clearing mocks to have a fresh calls history
            return waitForPromisesToResolve().then(() => jest.clearAllMocks());
        }

        // Initialize clean modules before each test
        // This reset top level static variables (in Onyx.js, OnyxCache.js, etc.)
        beforeEach(() => {
            jest.resetModules();
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const OnyxModule = require('../../lib');
            Onyx = OnyxModule.default;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            StorageMock = require('../../lib/storage').default;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            cache = require('../../lib/OnyxCache').default;
        });

        it('Should keep recently accessed items in cache', () => {
            // Given Storage with 10 different keys
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const range = generateRange(0, 10);
            StorageMock.getAllKeys.mockResolvedValue(range.map((number) => `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`));
            let connections: Array<{key: string; connection: Connection}> = [];

            // Given Onyx is configured with max 5 keys in cache
            return initOnyx({maxCachedKeysCount: 5})
                .then(() => {
                    // Given 10 connections for different keys
                    connections = range.map((number) => {
                        const key = `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`;
                        return {
                            key,
                            connection: Onyx.connect({key, callback: jest.fn()}),
                        };
                    });
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // When a new connection for a safe eviction key happens
                    Onyx.connect({key: `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}10`, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // The newly connected key should remain in cache
                    expect(cache.hasCacheForKey(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}10`)).toBe(true);

                    // With the updated implementation, all evictable keys are removed except the most recently added one
                    // Each time we connect to a safe eviction key, we remove all other evictable keys
                    connections.forEach(({key}) => {
                        expect(cache.hasCacheForKey(key)).toBe(false);
                    });
                });
        });

        it('Should clean cache when connections to eviction keys happen', () => {
            // Given storage with some data
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const range = generateRange(0, 10);
            const keyPrefix = ONYX_KEYS.COLLECTION.MOCK_COLLECTION;
            StorageMock.getAllKeys.mockResolvedValue(range.map((number) => `${keyPrefix}${number}`));
            let connections: Array<{key: string; connection: Connection}> = [];

            return initOnyx({
                maxCachedKeysCount: 3,
            })
                .then(() => {
                    connections = range.map((number) => {
                        const key = `${keyPrefix}${number}`;
                        return {
                            key,
                            connection: Onyx.connect({key, callback: jest.fn()}),
                        };
                    });
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    Onyx.connect({key: `${keyPrefix}10`, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // All previously connected evictable keys are removed
                    connections.forEach(({key}) => {
                        expect(cache.hasCacheForKey(key)).toBe(false);
                    });

                    // Only the newly connected key should remain in cache
                    expect(cache.hasCacheForKey(`${keyPrefix}10`)).toBe(true);
                });
        });

        it('Should prioritize eviction of evictableKeys over non-evictable keys when cache limit is reached', () => {
            const testKeys = {
                ...ONYX_KEYS,
                SAFE_FOR_EVICTION: 'evictable_',
                NOT_SAFE_FOR_EVICTION: 'critical_',
            };

            const criticalKey1 = `${testKeys.NOT_SAFE_FOR_EVICTION}1`;
            const criticalKey2 = `${testKeys.NOT_SAFE_FOR_EVICTION}2`;
            const criticalKey3 = `${testKeys.NOT_SAFE_FOR_EVICTION}3`;
            const evictableKey1 = `${testKeys.SAFE_FOR_EVICTION}1`;
            const evictableKey2 = `${testKeys.SAFE_FOR_EVICTION}2`;
            const evictableKey3 = `${testKeys.SAFE_FOR_EVICTION}3`;
            const triggerKey = `${testKeys.SAFE_FOR_EVICTION}trigger`;

            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const allKeys = [
                // Keys that should be evictable (these match the SAFE_FOR_EVICTION pattern)
                evictableKey1,
                evictableKey2,
                evictableKey3,
                triggerKey,
                // Keys that should NOT be evictable
                criticalKey1,
                criticalKey2,
                criticalKey3,
            ];
            StorageMock.getAllKeys.mockResolvedValue(allKeys);

            return initOnyx({
                keys: testKeys,
                maxCachedKeysCount: 3,
                evictableKeys: [testKeys.SAFE_FOR_EVICTION],
            })
                .then(() => {
                    // Verify keys are correctly identified as evictable or not
                    expect(cache.isEvictableKey?.(evictableKey1)).toBe(true);
                    expect(cache.isEvictableKey?.(evictableKey2)).toBe(true);
                    expect(cache.isEvictableKey?.(evictableKey3)).toBe(true);
                    expect(cache.isEvictableKey?.(triggerKey)).toBe(true);
                    expect(cache.isEvictableKey?.(criticalKey1)).toBe(false);

                    // Connect to non-evictable keys first
                    Onyx.connect({key: criticalKey1, callback: jest.fn()});
                    Onyx.connect({key: criticalKey2, callback: jest.fn()});
                    Onyx.connect({key: criticalKey3, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then connect to evictable keys
                    Onyx.connect({key: evictableKey1, callback: jest.fn()});
                    Onyx.connect({key: evictableKey2, callback: jest.fn()});
                    Onyx.connect({key: evictableKey3, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Trigger an eviction by connecting to a safe eviction key
                    Onyx.connect({key: triggerKey, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Previously connected evictable keys should be removed
                    expect(cache.hasCacheForKey(evictableKey1)).toBe(false);
                    expect(cache.hasCacheForKey(evictableKey2)).toBe(false);
                    expect(cache.hasCacheForKey(evictableKey3)).toBe(false);

                    // Non-evictable keys should remain in cache
                    expect(cache.hasCacheForKey(criticalKey1)).toBe(true);
                    expect(cache.hasCacheForKey(criticalKey2)).toBe(true);
                    expect(cache.hasCacheForKey(criticalKey3)).toBe(true);

                    // The trigger key should be in cache as it was just connected
                    expect(cache.hasCacheForKey(triggerKey)).toBe(true);
                });
        });

        it('Should not evict non-evictable keys even when cache limit is exceeded', () => {
            const testKeys = {
                ...ONYX_KEYS,
                SAFE_FOR_EVICTION: 'evictable_',
                NOT_SAFE_FOR_EVICTION: 'critical_',
            };

            const criticalKey1 = `${testKeys.NOT_SAFE_FOR_EVICTION}1`;
            const criticalKey2 = `${testKeys.NOT_SAFE_FOR_EVICTION}2`;
            const criticalKey3 = `${testKeys.NOT_SAFE_FOR_EVICTION}3`;
            const evictableKey1 = `${testKeys.SAFE_FOR_EVICTION}1`;
            // Additional trigger key for natural eviction
            const triggerKey = `${testKeys.SAFE_FOR_EVICTION}trigger`;

            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const allKeys = [
                evictableKey1,
                triggerKey,
                // Keys that should not be evicted
                criticalKey1,
                criticalKey2,
                criticalKey3,
            ];
            StorageMock.getAllKeys.mockResolvedValue(allKeys);

            return initOnyx({
                keys: testKeys,
                maxCachedKeysCount: 2,
                evictableKeys: [testKeys.SAFE_FOR_EVICTION],
            })
                .then(() => {
                    Onyx.connect({key: criticalKey1, callback: jest.fn()}); // Should never be evicted
                    Onyx.connect({key: criticalKey2, callback: jest.fn()}); // Should never be evicted
                    Onyx.connect({key: criticalKey3, callback: jest.fn()}); // Should never be evicted
                    Onyx.connect({key: evictableKey1, callback: jest.fn()}); // Should be evicted when we connect to triggerKey
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Trigger eviction by connecting to another safe eviction key
                    Onyx.connect({key: triggerKey, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // evictableKey1 should be evicted since it's an evictable key
                    expect(cache.hasCacheForKey(evictableKey1)).toBe(false);

                    // Non-evictable keys should remain in cache
                    expect(cache.hasCacheForKey(criticalKey1)).toBe(true);
                    expect(cache.hasCacheForKey(criticalKey2)).toBe(true);
                    expect(cache.hasCacheForKey(criticalKey3)).toBe(true);

                    // The trigger key should be in cache as it was just connected
                    expect(cache.hasCacheForKey(triggerKey)).toBe(true);
                });
        });
    });
});
