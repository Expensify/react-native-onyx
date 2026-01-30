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

            const OnyxModule = require('../../lib');
            Onyx = OnyxModule.default;

            StorageMock = require('../../lib/storage').default;

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
                    for (const {key} of connections) {
                        expect(cache.hasCacheForKey(key)).toBe(false);
                    }
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
                    for (const {key} of connections) {
                        expect(cache.hasCacheForKey(key)).toBe(false);
                    }

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

        it('should save RAM-only keys', () => {
            const testKeys = {
                ...ONYX_KEYS,
                COLLECTION: {
                    ...ONYX_KEYS.COLLECTION,
                    RAM_ONLY_COLLECTION: 'ramOnlyCollection'
                },
                RAM_ONLY_KEY: 'ramOnlyKey'
            }

            return initOnyx({
                keys: testKeys,
                ramOnlyKeys: [testKeys.COLLECTION.RAM_ONLY_COLLECTION, testKeys.RAM_ONLY_KEY]
            }).then(() => {
                expect(cache.isRamOnlyKey(testKeys.RAM_ONLY_KEY)).toBeTruthy()
                expect(cache.isRamOnlyKey(testKeys.COLLECTION.RAM_ONLY_COLLECTION)).toBeTruthy()
                expect(cache.isRamOnlyKey(testKeys.TEST_KEY)).toBeFalsy()
            })
        })
    });
});
