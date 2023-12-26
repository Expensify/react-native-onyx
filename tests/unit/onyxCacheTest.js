/* eslint-disable rulesdir/onyx-props-must-have-default */
import React from 'react';
import {render} from '@testing-library/react-native';
import _ from 'underscore';

import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';

describe('Onyx', () => {
    describe('Cache Service', () => {
        /** @type OnyxCache */
        let cache;

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
                expect(allKeys).toEqual([]);
            });

            it('Should keep storage keys', () => {
                // Given cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should keep storage keys even when no values are provided', () => {
                // Given cache with some items
                cache.set('mockKey');
                cache.set('mockKey2');
                cache.set('mockKey3');

                // Then the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
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
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });
        });

        describe('getValue', () => {
            it('Should return undefined when there is no stored value', () => {
                // Given empty cache

                // When a value is retrieved
                const result = cache.getValue('mockKey');

                // Then it should be undefined
                expect(result).not.toBeDefined();
            });

            it('Should return cached value when it exists', () => {
                // Given cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // When a value is retrieved
                // Then it should be the correct value
                expect(cache.getValue('mockKey')).toEqual({items: ['mockValue', 'mockValue2']});
                expect(cache.getValue('mockKey2')).toEqual('mockValue3');
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
                expect(cache.getAllKeys()).toEqual(expect.arrayContaining(['mockKey']));
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
                expect(allKeys).toEqual(['mockKey', 'mockKey2']);
            });
        });

        describe('set', () => {
            it('Should add data to cache when both key and value are provided', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then data should be cached
                const data = cache.getValue('mockKey');
                expect(data).toEqual({value: 'mockValue'});
            });

            it('Should store the key so that it is returned by `getAllKeys`', () => {
                // Given empty cache

                // When set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // Then but a key should be available
                expect(cache.getAllKeys()).toEqual(expect.arrayContaining(['mockKey']));
            });

            it('Should overwrite existing cache items for the Given key', () => {
                // Given cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue'});

                // When set is called for an existing key
                cache.set('mockKey2', {value: []});

                // Then the value should be overwritten
                expect(cache.getValue('mockKey2')).toEqual({value: []});
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
                expect(cache.getValue('mockKey')).not.toBeDefined();
                expect(cache.getAllKeys('mockKey').includes('mockKey')).toBe(false);
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
                expect(cache.getValue('mockKey')).toEqual({value: 'mockValue'});
                expect(cache.getValue('mockKey2')).toEqual({value: 'mockValue2'});
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
                expect(cache.getValue('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                });

                expect(cache.getValue('mockKey2')).toEqual({
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
                expect(cache.getValue('mockKey')).toEqual({
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
                expect(cache.getValue('mockKey')).toEqual([{ID: 3}, {added: 'field'}, {}, {ID: 1000}]);
            });

            it('Should merge arrays inside objects correctly', () => {
                // Given cache with existing array data
                cache.set('mockKey', {ID: [1]});

                // When merge is called with an array
                cache.merge({
                    mockKey: {ID: [2]},
                });

                // Then the first array is completely replaced by the second array
                expect(cache.getValue('mockKey')).toEqual({ID: [2]});
            });

            it('Should work with primitive values', () => {
                // Given cache with existing data
                cache.set('mockKey', {});

                // When merge is called with bool
                cache.merge({mockKey: false});

                // Then the object should be overwritten with a bool value
                expect(cache.getValue('mockKey')).toEqual(false);

                // When merge is called with number
                cache.merge({mockKey: 0});

                // Then the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual(0);

                // When merge is called with string
                cache.merge({mockKey: '123'});

                // Then the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual('123');

                // When merge is called with string again
                cache.merge({mockKey: '123'});

                // Then strings should not have been concatenated
                expect(cache.getValue('mockKey')).toEqual('123');

                // When merge is called with an object
                cache.merge({mockKey: {value: 'myMockObject'}});

                // Then the old primitive value should be overwritten with the object
                expect(cache.getValue('mockKey')).toEqual({value: 'myMockObject'});
            });

            it('Should ignore `undefined` values', () => {
                // Given cache with existing data
                cache.set('mockKey', {ID: 5});

                // When merge is called key value pair and the value is undefined
                cache.merge({mockKey: {ID: undefined}});

                // Then the key should still be in cache and the value unchanged
                expect(cache.getValue('mockKey')).toEqual({ID: 5});

                cache.merge({mockKey: undefined});

                // Then the key should still be in cache and the value unchanged
                expect(cache.getValue('mockKey')).toEqual({ID: 5});
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
                expect(cache.getAllKeys()).toEqual(['mockKey', 'mockKey2', 'mockKey3', 'mockKey4']);
            });

            it('Should throw if called with anything that is not an object', () => {
                expect(() => cache.merge([])).toThrow();
                expect(() => cache.merge('')).toThrow();
                expect(() => cache.merge(0)).toThrow();
                expect(() => cache.merge({})).not.toThrow();
            });

            it('Should merge `null` values', () => {
                // `null` values can override existing values and should also
                // be preserved during merges.
                cache.set('mockKey', {ID: 5});
                cache.set('mockNullKey', null);

                cache.merge({mockKey: null});

                expect(cache.getValue('mockKey')).toEqual(null);
                expect(cache.getValue('mockNullKey')).toEqual(null);
            });
        });

        describe('hasPendingTask', () => {
            it('Should return false when there is no started task', () => {
                // Given empty cache with no started tasks
                // When a task has not been started
                // Then it should return false
                expect(cache.hasPendingTask('mockTask')).toBe(false);
            });

            it('Should return true when a task is running', () => {
                // Given empty cache with no started tasks
                // When a unique task is started
                const promise = Promise.resolve();
                cache.captureTask('mockTask', promise);

                // Then `hasPendingTask` should return true
                expect(cache.hasPendingTask('mockTask')).toBe(true);

                // When the promise is completed
                return waitForPromisesToResolve().then(() => {
                    // Then `hasPendingTask` should return false
                    expect(cache.hasPendingTask('mockTask')).toBe(false);
                });
            });
        });

        describe('getTaskPromise', () => {
            it('Should return undefined when there is no stored value', () => {
                // Given empty cache with no started tasks

                // When a task is retrieved
                const task = cache.getTaskPromise('mockTask');

                // Then it should be undefined
                expect(task).not.toBeDefined();
            });

            it('Should return captured task when it exists', () => {
                // Given empty cache with no started tasks
                // When a unique task is started
                const promise = Promise.resolve({mockResult: true});
                cache.captureTask('mockTask', promise);

                // When a task is retrieved
                const taskPromise = cache.getTaskPromise('mockTask');

                // Then it should resolve with the same result as the captured task
                return taskPromise.then((result) => {
                    expect(result).toEqual({mockResult: true});
                });
            });
        });
    });

    describe('Onyx with Cache', () => {
        let Onyx;
        let StorageMock;
        let withOnyx;

        /** @type OnyxCache */
        let cache;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            OTHER_TEST: 'otherTest',
            COLLECTION: {
                MOCK_COLLECTION: 'mock_collection_',
            },
        };

        function initOnyx(overrides) {
            Onyx.init({
                keys: ONYX_KEYS,
                safeEvictionKeys: [ONYX_KEYS.COLLECTION.MOCK_COLLECTION],
                registerStorageEventListener: jest.fn(),
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
            withOnyx = OnyxModule.withOnyx;
            StorageMock = require('../../lib/storage').default;
            cache = require('../../lib/OnyxCache').default;
        });

        it('Expect a single call to getItem when multiple components use the same key', () => {
            // Given a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // Given some string value for that key exists in storage
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            StorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            return initOnyx()
                .then(() => {
                    // When multiple components are rendered
                    render(
                        <>
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                        </>,
                    );
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then Async storage `getItem` should be called only once
                    expect(StorageMock.getItem).toHaveBeenCalledTimes(1);
                });
        });

        it('Expect a single call to getAllKeys when multiple components use the same key', () => {
            // Given a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // Given some string value for that key exists in storage
            return initOnyx()
                .then(() => {
                    StorageMock.getItem.mockResolvedValue('"mockValue"');
                    StorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);

                    // When multiple components are rendered
                    render(
                        <>
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                        </>,
                    );
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then Async storage `getItem` should be called only once
                    expect(StorageMock.getAllKeys).toHaveBeenCalledTimes(1);
                });
        });

        it('Should keep recently accessed items in cache', () => {
            // Given Storage with 10 different keys
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const range = _.range(10);
            StorageMock.getAllKeys.mockResolvedValue(_.map(range, (number) => `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`));
            let connections;

            // Given Onyx is configured with max 5 keys in cache
            return initOnyx({
                maxCachedKeysCount: 5,
            })
                .then(() => {
                    // Given 10 connections for different keys
                    connections = _.map(range, (number) => {
                        const key = `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`;
                        return {
                            key,
                            connectionId: Onyx.connect({key, callback: jest.fn()}),
                        };
                    });
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // When a new connection for a safe eviction key happens
                    Onyx.connect({key: `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}9`, callback: jest.fn()});
                })
                .then(() => {
                    // Then the most recent 5 keys should remain in cache
                    _.range(5, 10).forEach((number) => {
                        const key = connections[number].key;
                        expect(cache.hasCacheForKey(key)).toBe(true);
                    });

                    // AND the least recent 5 should be dropped
                    _.range(0, 5).forEach((number) => {
                        const key = connections[number].key;
                        expect(cache.hasCacheForKey(key)).toBe(false);
                    });
                });
        });

        it('Expect multiple calls to getItem when value cannot be retrieved from cache', () => {
            // Given a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // Given some string value for that key exists in storage
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            StorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);

            return (
                initOnyx()
                    .then(() => {
                        // When a component is rendered
                        render(<TestComponentWithOnyx />);
                    })
                    .then(waitForPromisesToResolve)
                    .then(() => {
                        // When the key was removed from cache
                        cache.drop(ONYX_KEYS.TEST_KEY);
                    })

                    // Then When another component using the same storage key is rendered
                    .then(() => render(<TestComponentWithOnyx />))
                    .then(waitForPromisesToResolve)
                    .then(() => {
                        // Then Async storage `getItem` should be called twice
                        expect(StorageMock.getItem).toHaveBeenCalledTimes(2);
                    })
            );
        });

        it('Expect multiple calls to getItem when multiple keys are used', () => {
            // Given two component
            const TestComponentWithOnyx = withOnyx({
                testObject: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithCollections);

            const OtherTestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.OTHER_TEST,
                },
            })(ViewWithText);

            // Given some values exist in storage
            StorageMock.setItem(ONYX_KEYS.TEST_KEY, {ID: 15, data: 'mock object with ID'});
            StorageMock.setItem(ONYX_KEYS.OTHER_TEST, 'mock text');
            StorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY, ONYX_KEYS.OTHER_TEST]);
            return initOnyx()
                .then(() => {
                    // When the components are rendered multiple times
                    render(<TestComponentWithOnyx />);
                    render(<OtherTestComponentWithOnyx />);
                    render(<TestComponentWithOnyx />);
                    render(<OtherTestComponentWithOnyx />);
                    render(<OtherTestComponentWithOnyx />);
                    render(<TestComponentWithOnyx />);
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then Async storage `getItem` should be called exactly two times (once for each key)
                    expect(StorageMock.getItem).toHaveBeenCalledTimes(2);
                    expect(StorageMock.getItem).toHaveBeenNthCalledWith(1, ONYX_KEYS.TEST_KEY);
                    expect(StorageMock.getItem).toHaveBeenNthCalledWith(2, ONYX_KEYS.OTHER_TEST);
                });
        });

        it('Should clean cache when connections to eviction keys happen', () => {
            // Given storage with some data
            StorageMock.getItem.mockResolvedValue('"mockValue"');
            const range = _.range(1, 10);
            StorageMock.getAllKeys.mockResolvedValue(_.map(range, (n) => `key${n}`));

            // Given Onyx with LRU size of 3
            return initOnyx({maxCachedKeysCount: 3})
                .then(() => {
                    // When 4 connections for different keys happen
                    Onyx.connect({key: 'key1', callback: jest.fn()});
                    Onyx.connect({key: 'key2', callback: jest.fn()});
                    Onyx.connect({key: 'key3', callback: jest.fn()});
                    Onyx.connect({key: 'key4', callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then keys 1,2,3,4 should be in cache
                    expect(cache.hasCacheForKey('key1')).toBe(true);
                    expect(cache.hasCacheForKey('key2')).toBe(true);
                    expect(cache.hasCacheForKey('key3')).toBe(true);
                    expect(cache.hasCacheForKey('key4')).toBe(true);

                    // When A connection for safe eviction key happens
                    Onyx.connect({key: ONYX_KEYS.COLLECTION.MOCK_COLLECTION, callback: jest.fn()});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // Then key 1 should no longer be in cache
                    expect(cache.hasCacheForKey('key1')).toBe(false);

                    // AND the rest of the keys should be in cache
                    expect(cache.hasCacheForKey('key2')).toBe(true);
                    expect(cache.hasCacheForKey('key3')).toBe(true);
                    expect(cache.hasCacheForKey('key4')).toBe(true);
                });
        });
    });
});
