import type OnyxInstance from '../../lib/Onyx';
import type OnyxCache from '../../lib/OnyxCache';
import type {CacheTask} from '../../lib/OnyxCache';
import type OnyxKeysType from '../../lib/OnyxKeys';
import type MockedStorage from '../../lib/storage/__mocks__';
import type {InitOptions} from '../../lib/types';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const MOCK_TASK = 'mockTask' as CacheTask;

/**
 * Builds an extra cache instance in its own module registry, so a `hydrate()` result can be compared
 * against the `merge()` result for the same input without the two sharing any state.
 */
function createIsolatedCache(): typeof OnyxCache {
    let isolated!: typeof OnyxCache;

    jest.isolateModules(() => {
        isolated = require('../../lib/OnyxCache').default;
    });

    return isolated;
}

/** Asserts that two cache instances are indistinguishable through the cache's public read surface. */
function expectSameCacheState(actual: typeof OnyxCache, expected: typeof OnyxCache, keys: string[]) {
    expect(actual.getAllKeys()).toEqual(expected.getAllKeys());

    for (const key of keys) {
        expect(actual.get(key)).toEqual(expected.get(key));
        expect(actual.hasCacheForKey(key)).toBe(expected.hasCacheForKey(key));
        expect(actual.hasNullishStorageKey(key)).toBe(expected.hasNullishStorageKey(key));
    }
}

describe('Onyx', () => {
    describe('Cache Service', () => {
        /** @type OnyxCache */
        let cache: typeof OnyxCache;

        // Always use a "fresh" instance
        beforeEach(() => {
            jest.resetModules();

            cache = require('../../lib/OnyxCache').default;
        });

        describe('getAllKeys', () => {
            it('should be empty initially', () => {
                // Given empty cache

                // When all keys are retrieved
                const allKeys = cache.getAllKeys();

                // Then the result should be empty
                expect(allKeys).toEqual(new Set());
            });

            it('should keep storage keys', () => {
                // Given cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3']));
            });

            it('should keep storage keys even when no values are provided', () => {
                // Given cache with some items
                cache.set('mockKey', undefined);
                cache.set('mockKey2', undefined);
                cache.set('mockKey3', undefined);

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(new Set(['mockKey', 'mockKey2', 'mockKey3']));
            });

            it('should not store duplicate keys', () => {
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
            it('should return undefined when there is no stored value', () => {
                // Given empty cache

                // When a value is retrieved
                const result = cache.get('mockKey');

                // Then it should be undefined
                expect(result).not.toBeDefined();
            });

            it('should return cached value when it exists', () => {
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
            it('should return false when there is no stored value', () => {
                // Given empty cache

                // When a value does not exist in cache
                // Then it should return false
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
            });

            it('should return true when cached value exists', () => {
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
            it('should store the key so that it is returned by `getAllKeys`', () => {
                // Given empty cache

                // When set is called with key and value
                cache.addKey('mockKey');

                // Then there should be no cached value
                expect(cache.hasCacheForKey('mockKey')).toBe(false);

                // Then but a key should be available
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey']));
            });

            it('should not make duplicate keys', () => {
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
            it('should add data to cache when both key and value are provided', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then data should be cached
                const data = cache.get('mockKey');
                expect(data).toEqual({value: 'mockValue'});
            });

            it('should store the key so that it is returned by `getAllKeys`', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then but a key should be available
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey']));
            });

            it('should overwrite existing cache items for the Given key', () => {
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
            it('should remove the key from cache', () => {
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
            it('should create the value in cache when it does not exist', () => {
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

            it('should merge data to existing cache value', () => {
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

            it('should merge objects correctly', () => {
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

            it('should merge arrays correctly', () => {
                // Given cache with existing array data
                cache.set('mockKey', [{ID: 1}, {ID: 2}, {ID: 3}]);

                // When merge is called with an array
                cache.merge({
                    mockKey: [{ID: 3}, {added: 'field'}, {}, {ID: 1000}],
                });

                // Then the arrays should be replaced as expected
                expect(cache.get('mockKey')).toEqual([{ID: 3}, {added: 'field'}, {}, {ID: 1000}]);
            });

            it('should merge arrays inside objects correctly', () => {
                // Given cache with existing array data
                cache.set('mockKey', {ID: [1]});

                // When merge is called with an array
                cache.merge({
                    mockKey: {ID: [2]},
                });

                // Then the first array is completely replaced by the second array
                expect(cache.get('mockKey')).toEqual({ID: [2]});
            });

            it('should work with primitive values', () => {
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

            it('should ignore `undefined` values', () => {
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

            it('should update storageKeys when new keys are created', () => {
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

            it('should throw if called with anything that is not an object', () => {
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge([])).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge('')).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.merge(0)).toThrow();
                expect(() => cache.merge({})).not.toThrow();
            });

            it('should remove `null` values when merging', () => {
                cache.set('mockKey', {ID: 5});
                cache.set('mockNullKey', null);

                cache.merge({mockKey: null});

                expect(cache.get('mockKey')).toEqual(undefined);
                expect(cache.get('mockNullKey')).toEqual(undefined);
            });
        });

        describe('hydrate', () => {
            // Every value shape init can hand the cache. Built fresh per call because `hydrate()` stores
            // values by reference, so the two caches under comparison must never share source objects.
            const buildStorageData = (): Record<string, unknown> => ({
                stringKey: 'mockValue',
                numberKey: 0,
                booleanKey: false,
                emptyObjectKey: {},
                plainObjectKey: {value: 'mockValue'},
                nestedObjectKey: {a: {b: {c: 1}}},
                nestedNullsKey: {keep: 1, drop: null, nested: {keep: 2, drop: null}},
                arrayKey: [{ID: 1}, {ID: 2}],
                objectWithArrayKey: {ID: [1, 2]},
                nullKey: null,
                undefinedKey: undefined,
            });

            const ALL_KEYS = Object.keys(buildStorageData());

            it('should produce the same cache state as merge() for an empty cache', () => {
                // Given two empty caches
                const mergeCache = createIsolatedCache();

                // When one is hydrated and the other merged with the same data
                cache.hydrate(buildStorageData());
                mergeCache.merge(buildStorageData());

                // Then both caches are indistinguishable through their public read surface
                expectSameCacheState(cache, mergeCache, ALL_KEYS);
            });

            it('should produce the same cache state as merge() when keys already have values', () => {
                // Given two caches holding the same pre-existing values (e.g. a write landed while
                // storage was still being read). Both existing values overlap the storage value on a
                // leaf, so the merge direction is actually exercised.
                const mergeCache = createIsolatedCache();
                const buildExistingData = () => ({
                    plainObjectKey: {value: 'fromWrite', fromWrite: true},
                    nestedObjectKey: {a: {b: {c: 99, fromWrite: true}}},
                    stringKey: 'fromWrite',
                });

                for (const [key, value] of Object.entries(buildExistingData())) {
                    cache.set(key, value);
                    mergeCache.set(key, value);
                }

                // When one is hydrated and the other merged with the same data
                cache.hydrate(buildStorageData());
                mergeCache.merge(buildStorageData());

                // Then the fallback merge inside hydrate() matches merge() exactly
                expectSameCacheState(cache, mergeCache, ALL_KEYS);

                // And the value loaded from storage wins on every overlapping leaf, as merge() does
                expect(cache.get('plainObjectKey')).toEqual({value: 'mockValue', fromWrite: true});
                expect(cache.get('nestedObjectKey')).toEqual({a: {b: {c: 1, fromWrite: true}}});
                expect(cache.get('stringKey')).toBe('mockValue');
            });

            it('should register every key, including keys with nullish values', () => {
                // When hydrate is called with nullish and non-nullish values
                cache.hydrate(buildStorageData());

                // Then all of them are reported by getAllKeys, so nothing is invisible to reads
                expect(cache.getAllKeys()).toEqual(new Set(ALL_KEYS));
                expect(cache.getAllKeys().has('nullKey')).toBe(true);
                expect(cache.getAllKeys().has('undefinedKey')).toBe(true);
            });

            it('should store values by reference when no normalization is needed', () => {
                // Given a value with no nested nullish properties
                const value = {id: 1, nested: {deep: true}};

                // When hydrate is called on an empty cache
                cache.hydrate({mockKey: value});

                // Then the value is stored as is - this is the clone that hydrate() exists to skip
                expect(cache.get('mockKey')).toBe(value);
            });

            it('should normalize values that carry nested nullish properties', () => {
                // Given a value with nested nulls
                const value = {keep: 1, drop: null, nested: {keep: 2, drop: null}};

                // When hydrate is called
                cache.hydrate({mockKey: value});

                // Then the cached value is a cleaned copy
                expect(cache.get('mockKey')).not.toBe(value);
                expect(cache.get('mockKey')).toEqual({keep: 1, nested: {keep: 2}});

                // And the source object handed to hydrate is left untouched
                expect(value).toEqual({keep: 1, drop: null, nested: {keep: 2, drop: null}});
            });

            it('should keep the existing reference when the hydrated value changes nothing', () => {
                // Given a cache that already holds a deep-equal value
                const existing = {id: 1, nested: {deep: true}};
                cache.set('mockKey', existing);

                // When hydrate is called with an equal but distinct value
                cache.hydrate({mockKey: {id: 1, nested: {deep: true}}});

                // Then the reference is preserved, so subscribers don't see a spurious change
                expect(cache.get('mockKey')).toBe(existing);
            });

            it('should remove `null` values from the storage map and mark them nullish', () => {
                // Given a cache with an existing value
                cache.set('mockKey', {ID: 5});

                // When hydrate is called with null
                cache.hydrate({mockKey: null, mockNullKey: null});

                // Then the values are dropped but the keys stay known
                expect(cache.get('mockKey')).toBeUndefined();
                expect(cache.get('mockNullKey')).toBeUndefined();
                expect(cache.hasNullishStorageKey('mockKey')).toBe(true);
                expect(cache.hasNullishStorageKey('mockNullKey')).toBe(true);
                expect(cache.getAllKeys()).toEqual(new Set(['mockKey', 'mockNullKey']));
            });

            it('should leave the existing value untouched for `undefined` values', () => {
                // Given a cache with an existing value
                cache.set('mockKey', {ID: 5});

                // When hydrate is called with undefined, which means "no change"
                cache.hydrate({mockKey: undefined});

                // Then the value is unchanged
                expect(cache.get('mockKey')).toEqual({ID: 5});
            });

            it('should expose hydrated collection members through collection reads, same as merge()', () => {
                // Given two caches that know about the same collection key
                const mergeCache = createIsolatedCache();
                const collectionKey = 'mock_collection_';
                const collectionData = {
                    [`${collectionKey}1`]: {id: 1},
                    [`${collectionKey}2`]: {id: 2},
                    [`${collectionKey}3`]: null,
                };

                cache.setCollectionKeys(new Set([collectionKey]));
                mergeCache.setCollectionKeys(new Set([collectionKey]));

                // When one is hydrated and the other merged with the same collection members
                cache.hydrate({...collectionData});
                mergeCache.merge({...collectionData});

                // Then the collection snapshot is rebuilt and reports the same members
                expect(cache.getCollectionData(collectionKey)).toEqual({
                    [`${collectionKey}1`]: {id: 1},
                    [`${collectionKey}2`]: {id: 2},
                });
                expect(cache.getCollectionData(collectionKey)).toEqual(mergeCache.getCollectionData(collectionKey));
            });

            it('should throw if called with anything that is not an object', () => {
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.hydrate([])).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.hydrate('')).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.hydrate(0)).toThrow();
                // @ts-expect-error -- intentionally testing invalid input
                expect(() => cache.hydrate(null)).toThrow();
                expect(() => cache.hydrate({})).not.toThrow();
            });
        });

        describe('hasPendingTask', () => {
            it('should return false when there is no started task', () => {
                // Given empty cache with no started tasks
                // When a task has not been started
                // Then it should return false
                expect(cache.hasPendingTask(MOCK_TASK)).toBe(false);
            });

            it('should return true when a task is running', () => {
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
            it('should return undefined when there is no stored value', () => {
                // Given empty cache with no started tasks

                // When a task is retrieved
                const task = cache.getTaskPromise(MOCK_TASK);

                // Then it should be undefined
                expect(task).not.toBeDefined();
            });

            it('should return captured task when it exists', () => {
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
    });

    describe('Onyx with Cache', () => {
        let Onyx: typeof OnyxInstance;
        let StorageMock: typeof MockedStorage;
        let OnyxKeys: typeof OnyxKeysType;

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

            const OnyxModule = require('../../lib');
            Onyx = OnyxModule.default;

            StorageMock = require('../../lib/storage').default;

            cache = require('../../lib/OnyxCache').default;

            OnyxKeys = require('../../lib/OnyxKeys').default;
        });

        describe('eager loading during initialisation', () => {
            beforeEach(() => {
                StorageMock = require('../../lib/storage').default;
            });

            it('should load all storage data into cache during init', async () => {
                await StorageMock.setItem(ONYX_KEYS.TEST_KEY, 'storageValue');
                await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1, name: 'Item 1'});
                await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 2, name: 'Item 2'});
                await initOnyx();

                expect(cache.getAllKeys().size).toBe(3);
                expect(cache.get(ONYX_KEYS.TEST_KEY)).toBe('storageValue');
                expect(cache.get(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`)).toEqual({id: 1, name: 'Item 1'});
                expect(cache.get(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`)).toEqual({id: 2, name: 'Item 2'});
            });

            it('should not load RAM-only keys from storage during init', async () => {
                const testKeys = {
                    ...ONYX_KEYS,
                    RAM_ONLY_KEY: 'ramOnlyKey',
                };

                await StorageMock.setItem(testKeys.RAM_ONLY_KEY, 'staleValue');
                await StorageMock.setItem(ONYX_KEYS.TEST_KEY, 'normalValue');
                await initOnyx({keys: testKeys, ramOnlyKeys: [testKeys.RAM_ONLY_KEY]});

                expect(cache.getAllKeys().size).toBe(1);
                expect(cache.get(testKeys.RAM_ONLY_KEY)).toBeUndefined();
                expect(cache.get(ONYX_KEYS.TEST_KEY)).toBe('normalValue');
            });

            it('should merge default key states with storage data during init', async () => {
                await StorageMock.setItem(ONYX_KEYS.OTHER_TEST, {fromStorage: true});
                await initOnyx({
                    initialKeyStates: {
                        [ONYX_KEYS.OTHER_TEST]: {fromDefault: true},
                    },
                });

                // Default key states are merged on top of storage data.
                expect(cache.get(ONYX_KEYS.OTHER_TEST)).toEqual({fromStorage: true, fromDefault: true});
            });

            it('should use default key states when storage data is not available for a key', async () => {
                await StorageMock.clear();
                await initOnyx({
                    initialKeyStates: {
                        [ONYX_KEYS.OTHER_TEST]: 42,
                    },
                });

                expect(cache.get(ONYX_KEYS.OTHER_TEST)).toBe(42);
            });

            it('should gracefully handle Storage.getAll() failure and boot with defaults', async () => {
                (StorageMock.getAll as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('Database corrupted')));

                await initOnyx({
                    initialKeyStates: {
                        [ONYX_KEYS.OTHER_TEST]: 42,
                    },
                });

                expect(cache.getAllKeys().size).toBe(1);
                expect(cache.get(ONYX_KEYS.OTHER_TEST)).toBe(42);
            });

            it('should populate cache key index with all storage keys during init', async () => {
                await StorageMock.setItem(ONYX_KEYS.TEST_KEY, 'value1');
                await StorageMock.setItem(ONYX_KEYS.OTHER_TEST, 'value2');
                await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});
                await initOnyx();

                const allKeys = cache.getAllKeys();
                expect(allKeys.size).toBe(3);
                expect(allKeys.has(ONYX_KEYS.TEST_KEY)).toBe(true);
                expect(allKeys.has(ONYX_KEYS.OTHER_TEST)).toBe(true);
                expect(allKeys.has(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`)).toBe(true);
            });

            it('should register keys whose stored value is nullish', async () => {
                // Given storage holding a null value alongside a normal one
                await StorageMock.setItem(ONYX_KEYS.TEST_KEY, null);
                await StorageMock.setItem(ONYX_KEYS.OTHER_TEST, 'value');
                await initOnyx();

                // Then the nullish key is still part of the key index, so reads don't treat it as unloaded
                expect(cache.getAllKeys()).toEqual(new Set([ONYX_KEYS.TEST_KEY, ONYX_KEYS.OTHER_TEST]));
                expect(cache.get(ONYX_KEYS.TEST_KEY)).toBeUndefined();
                expect(cache.hasNullishStorageKey(ONYX_KEYS.TEST_KEY)).toBe(true);
                expect(cache.hasCacheForKey(ONYX_KEYS.TEST_KEY)).toBe(true);
            });

            it('should expose collection members loaded from storage through collection reads', async () => {
                // Given storage holding collection members
                await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1, name: 'Item 1'});
                await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 2, name: 'Item 2'});
                await initOnyx();

                // Then the collection index is populated, so the snapshot contains both members
                expect(cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION)).toEqual({
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 1, name: 'Item 1'},
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`]: {id: 2, name: 'Item 2'},
                });
                expect(OnyxKeys.getCollectionKey(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`)).toBe(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
            });

            it('should merge, not overwrite, keys written while storage was still being read', async () => {
                // Given a storage read that has not resolved yet
                let releaseGetAll: (() => void) | undefined;
                const gate = new Promise<void>((resolve) => {
                    releaseGetAll = resolve;
                });
                (StorageMock.getAll as jest.Mock).mockImplementationOnce(() => gate.then(() => [[ONYX_KEYS.TEST_KEY, {fromStorage: true, shared: 'fromStorage'}]]));

                Onyx.init({keys: ONYX_KEYS});

                // When a write lands on that key before the read completes
                cache.set(ONYX_KEYS.TEST_KEY, {fromWrite: true, shared: 'fromWrite'});
                releaseGetAll?.();
                await waitForPromisesToResolve();

                // Then hydrate falls back to a merge instead of dropping the write, and the value from
                // storage wins on the overlapping leaf - exactly what the old merge-based init did
                expect(cache.get(ONYX_KEYS.TEST_KEY)).toEqual({fromStorage: true, fromWrite: true, shared: 'fromStorage'});
            });

            it('should leave the cache in the same state a merge-based init would produce', async () => {
                // Given storage holding every value shape init has to deal with
                const storageData: Record<string, unknown> = {
                    [ONYX_KEYS.TEST_KEY]: 'storageValue',
                    [ONYX_KEYS.OTHER_TEST]: {nested: {value: 1}, keep: true, drop: null},
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 1, name: 'Item 1'},
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`]: [{ID: 1}, {ID: 2}],
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}3`]: null,
                };
                const allKeys = Object.keys(storageData);

                await StorageMock.multiSet(Object.entries(storageData));
                await initOnyx();

                // When the previous init path (setAllKeys + merge) is replayed on a separate cache
                const mergeCache = createIsolatedCache();
                mergeCache.setCollectionKeys(new Set([ONYX_KEYS.COLLECTION.MOCK_COLLECTION]));
                mergeCache.setAllKeys(allKeys);
                mergeCache.merge({...storageData});

                // Then the hydrated cache is indistinguishable from it
                expectSameCacheState(cache, mergeCache, allKeys);
                expect(cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION)).toEqual(mergeCache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION));
            });
        });

        describe('getCollectionData', () => {
            it('should return a frozen object', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const result = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(result).toBeDefined();
                expect(Object.isFrozen(result)).toBe(true);
            });

            it('should return the same reference when nothing changed', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const first = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                const second = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(first).toBe(second);
            });

            it('should return a new reference after a member is updated', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 2});
                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                expect(before).not.toBe(after);
                expect(after).toEqual({[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 2}});
            });

            it('should return a new reference after a member is added', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 2});
                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                expect(before).not.toBe(after);
                expect(after).toEqual({
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 1},
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`]: {id: 2},
                });
            });

            it('should return a stable empty reference for empty collections when keys are loaded', async () => {
                await initOnyx();
                // Set a key so storageKeys is non-empty, but not a member of MOCK_COLLECTION
                await Onyx.set(ONYX_KEYS.TEST_KEY, 'value');

                const first = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                const second = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                expect(first).toBeDefined();
                expect(first).toBe(second);
                expect(Object.keys(first!)).toHaveLength(0);
            });

            it('should return undefined for empty collections when no keys are loaded', async () => {
                await initOnyx();

                const result = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(result).toBeUndefined();
            });

            it('should return a new reference when a member is removed and another added simultaneously', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 2});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                // Remove member 1 and add member 3 — count stays the same (2) but content changed
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, null);
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}3`, {id: 3});
                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                expect(before).not.toBe(after);
                expect(after).toEqual({
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`]: {id: 2},
                    [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}3`]: {id: 3},
                });
            });

            it('should return the stable empty reference after all members are removed', async () => {
                await initOnyx();
                // Unrelated key keeps storageKeys non-empty so an empty collection is treated as "loaded and empty"
                await Onyx.set(ONYX_KEYS.TEST_KEY, 'value');
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const populated = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(Object.keys(populated!)).toHaveLength(1);

                // Remove the last member — the collection becomes empty
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, null);

                const first = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                const second = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                expect(first).toBeDefined();
                expect(Object.keys(first!)).toHaveLength(0);
                // Reads must return the same empty reference so useSyncExternalStore doesn't re-render
                expect(first).toBe(second);
            });

            it('should preserve unchanged member references when a sibling is updated', async () => {
                await initOnyx();
                const member1Value = {id: 1, name: 'unchanged'};
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, member1Value);
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 2});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}2`, {id: 3});
                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                // Snapshot reference changed (sibling updated)
                expect(before).not.toBe(after);
                // But unchanged member keeps the same reference
                expect(after?.[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]).toBe(member1Value);
            });
        });

        describe('hasValueChanged', () => {
            it('should return false for the same reference (fast path)', async () => {
                await initOnyx();
                const value = {id: 1, name: 'test'};
                cache.set('test', value);

                expect(cache.hasValueChanged('test', value)).toBe(false);
            });

            it('should return false for deep-equal but different reference', async () => {
                await initOnyx();
                cache.set('test', {id: 1, name: 'test'});

                expect(cache.hasValueChanged('test', {id: 1, name: 'test'})).toBe(false);
            });

            it('should return true when value differs', async () => {
                await initOnyx();
                cache.set('test', {id: 1});

                expect(cache.hasValueChanged('test', {id: 2})).toBe(true);
            });
        });

        describe('merge', () => {
            it('should not mark collection dirty when merged value is unchanged', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1, name: 'test'});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                // Merge with identical values — fastMerge returns same reference, so no-op
                cache.merge({[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 1, name: 'test'}});

                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(before).toBe(after);
            });

            it('should mark collection dirty when a member value changes', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                const before = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);

                cache.merge({[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: {id: 2}});

                const after = cache.getCollectionData(ONYX_KEYS.COLLECTION.MOCK_COLLECTION);
                expect(before).not.toBe(after);
                expect(after![`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]).toEqual({id: 2});
            });

            it('should handle null values by removing the key from storageMap', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                cache.merge({[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: null});

                expect(cache.get(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`)).toBeUndefined();
            });

            it('should skip undefined values without modifying storageMap', async () => {
                await initOnyx();
                await Onyx.set(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`, {id: 1});

                cache.merge({[`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`]: undefined});

                expect(cache.get(`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}1`)).toEqual({id: 1});
            });
        });

        it('should save RAM-only keys', () => {
            const testKeys = {
                ...ONYX_KEYS,
                COLLECTION: {
                    ...ONYX_KEYS.COLLECTION,
                    RAM_ONLY_COLLECTION: 'ramOnlyCollection',
                },
                RAM_ONLY_KEY: 'ramOnlyKey',
            };

            return initOnyx({
                keys: testKeys,
                ramOnlyKeys: [testKeys.COLLECTION.RAM_ONLY_COLLECTION, testKeys.RAM_ONLY_KEY],
            }).then(() => {
                expect(OnyxKeys.isRamOnlyKey(testKeys.RAM_ONLY_KEY)).toBeTruthy();
                expect(OnyxKeys.isRamOnlyKey(testKeys.COLLECTION.RAM_ONLY_COLLECTION)).toBeTruthy();
                expect(OnyxKeys.isRamOnlyKey(testKeys.TEST_KEY)).toBeFalsy();
            });
        });
    });
});
