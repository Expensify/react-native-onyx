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
                // GIVEN empty cache

                // WHEN all keys are retrieved
                const allKeys = cache.getAllKeys();

                // THEN the result should be empty
                expect(allKeys).toEqual([]);
            });

            it('Should keep storage keys', () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // THEN the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should keep storage keys even when no values are provided', () => {
                // GIVEN cache with some items
                cache.set('mockKey');
                cache.set('mockKey2');
                cache.set('mockKey3');

                // THEN the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should not store duplicate keys', () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // WHEN an existing keys is later updated
                cache.set('mockKey2', 'new mock value');

                // THEN getAllKeys should not include a duplicate value
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });
        });

        describe('getValue', () => {
            it('Should return undefined when there is no stored value', () => {
                // GIVEN empty cache

                // WHEN a value is retrieved
                const result = cache.getValue('mockKey');

                // THEN it should be undefined
                expect(result).not.toBeDefined();
            });

            it('Should return cached value when it exists', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a value is retrieved
                // THEN it should be the correct value
                expect(cache.getValue('mockKey')).toEqual({items: ['mockValue', 'mockValue2']});
                expect(cache.getValue('mockKey2')).toEqual('mockValue3');
            });
        });

        describe('hasCacheForKey', () => {
            it('Should return false when there is no stored value', () => {
                // GIVEN empty cache

                // WHEN a value does not exist in cache
                // THEN it should return false
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
            });

            it('Should return true when cached value exists', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a value exists in cache
                // THEN it should return true
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.hasCacheForKey('mockKey2')).toBe(true);
            });
        });

        describe('addKey', () => {
            it('Should store the key so that it is returned by `getAllKeys`', () => {
                // GIVEN empty cache

                // WHEN set is called with key and value
                cache.addKey('mockKey');

                // THEN there should be no cached value
                expect(cache.hasCacheForKey('mockKey')).toBe(false);

                // THEN but a key should be available
                expect(cache.getAllKeys()).toEqual(expect.arrayContaining(['mockKey']));
            });

            it('Should not make duplicate keys', () => {
                // GIVEN empty cache

                // WHEN the same item is added multiple times
                cache.addKey('mockKey');
                cache.addKey('mockKey');
                cache.addKey('mockKey2');
                cache.addKey('mockKey');

                // THEN getAllKeys should not include a duplicate value
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2']);
            });
        });

        describe('set', () => {
            it('Should add data to cache when both key and value are provided', () => {
                // GIVEN empty cache

                // WHEN set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // THEN data should be cached
                const data = cache.getValue('mockKey');
                expect(data).toEqual({value: 'mockValue'});
            });

            it('Should store the key so that it is returned by `getAllKeys`', () => {
                // GIVEN empty cache

                // WHEN set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // THEN but a key should be available
                expect(cache.getAllKeys()).toEqual(expect.arrayContaining(['mockKey']));
            });

            it('Should overwrite existing cache items for the given key', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue'});

                // WHEN set is called for an existing key
                cache.set('mockKey2', {value: []});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey2')).toEqual({value: []});
            });
        });

        describe('drop', () => {
            it('Should NOT remove the key from all keys', () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // WHEN an key is removed
                cache.drop('mockKey2');

                // THEN getAllKeys should still include the key
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(expect.arrayContaining(['mockKey2']));
            });

            it('Should remove the key from cache', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a key is removed
                cache.drop('mockKey');

                // THEN a value should not be available in cache
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
                expect(cache.getValue('mockKey')).not.toBeDefined();
            });
        });

        describe('merge', () => {
            it('Should create the value in cache when it does not exist', () => {
                // GIVEN empty cache

                // WHEN merge is called with new key value pairs
                cache.merge({
                    mockKey: {value: 'mockValue'},
                    mockKey2: {value: 'mockValue2'}
                });

                // THEN data should be created in cache
                expect(cache.getValue('mockKey')).toEqual({value: 'mockValue'});
                expect(cache.getValue('mockKey2')).toEqual({value: 'mockValue2'});
            });

            it('Should merge data to existing cache value', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue', mock: 'mock', items: [3, 4, 5]});

                // WHEN merge is called with existing key value pairs
                cache.merge({
                    mockKey: {mockItems: []},
                    mockKey2: {items: [1, 2], other: 'overwrittenMockValue'}
                });

                // THEN the values should be merged together in cache
                expect(cache.getValue('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                });

                expect(cache.getValue('mockKey2')).toEqual({
                    other: 'overwrittenMockValue',
                    items: [1, 2, 5],
                    mock: 'mock',
                });
            });

            it('Should merge objects correctly', () => {
                // GIVEN cache with existing object data
                cache.set('mockKey', {value: 'mockValue', anotherValue: 'overwrite me'});

                // WHEN merge is called for a key with object value
                cache.merge({
                    mockKey: {mockItems: [], anotherValue: 'overwritten'}
                });

                // THEN the values should be merged together in cache
                expect(cache.getValue('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                    anotherValue: 'overwritten',
                });
            });

            it('Should merge arrays correctly', () => {
                // GIVEN cache with existing array data
                cache.set('mockKey', [{ID: 1}, {ID: 2}, {ID: 3}]);

                // WHEN merge is called with an array
                cache.merge({
                    mockKey: [{ID: 3}, {added: 'field'}, {}, {ID: 1000}]
                });

                // THEN the arrays should be merged as expected
                expect(cache.getValue('mockKey')).toEqual([
                    {ID: 3}, {ID: 2, added: 'field'}, {ID: 3}, {ID: 1000}
                ]);
            });

            it('Should work with primitive values', () => {
                // GIVEN cache with existing data
                cache.set('mockKey', {});

                // WHEN merge is called with bool
                cache.merge({mockKey: false});

                // THEN the object should be overwritten with a bool value
                expect(cache.getValue('mockKey')).toEqual(false);

                // WHEN merge is called with number
                cache.merge({mockKey: 0});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual(0);

                // WHEN merge is called with string
                cache.merge({mockKey: '123'});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual('123');

                // WHEN merge is called with string again
                cache.merge({mockKey: '123'});

                // THEN strings should not have been concatenated
                expect(cache.getValue('mockKey')).toEqual('123');

                // WHEN merge is called with an object
                cache.merge({mockKey: {value: 'myMockObject'}});

                // THEN the old primitive value should be overwritten with the object
                expect(cache.getValue('mockKey')).toEqual({value: 'myMockObject'});
            });

            it('Should do nothing to a key which value is `undefined`', () => {
                // GIVEN cache with existing data
                cache.set('mockKey', {ID: 5});

                // WHEN merge is called key value pair and the value is undefined
                cache.merge({mockKey: undefined});

                // THEN the key should still be in cache and the value unchanged
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.getValue('mockKey')).toEqual({ID: 5});
            });

            it('Should update storageKeys when new keys are created', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue', mock: 'mock', items: [3, 4, 5]});

                // WHEN merge is called with existing key value pairs
                cache.merge({
                    mockKey: {mockItems: []},
                    mockKey3: {ID: 3},
                    mockKey4: {ID: 4},
                });

                // THEN getAllStorage keys should return updated storage keys
                expect(cache.getAllKeys()).toEqual(['mockKey', 'mockKey2', 'mockKey3', 'mockKey4']);
            });
        });

        describe('hasPendingTask', () => {
            it('Should return false when there is no started task', () => {
                // GIVEN empty cache with no started tasks
                // WHEN a task has not been started
                // THEN it should return false
                expect(cache.hasPendingTask('mockTask')).toBe(false);
            });

            it('Should return true when a task is running', () => {
                // GIVEN empty cache with no started tasks
                // WHEN a unique task is started
                const promise = Promise.resolve();
                cache.captureTask('mockTask', promise);

                // THEN `hasPendingTask` should return true
                expect(cache.hasPendingTask('mockTask')).toBe(true);

                // WHEN the promise is completed
                return waitForPromisesToResolve()
                    .then(() => {
                        // THEN `hasPendingTask` should return false
                        expect(cache.hasPendingTask('mockTask')).toBe(false);
                    });
            });
        });

        describe('getTaskPromise', () => {
            it('Should return undefined when there is no stored value', () => {
                // GIVEN empty cache with no started tasks

                // WHEN a task is retrieved
                const task = cache.getTaskPromise('mockTask');

                // THEN it should be undefined
                expect(task).not.toBeDefined();
            });

            it('Should return captured task when it exists', () => {
                // GIVEN empty cache with no started tasks
                // WHEN a unique task is started
                const promise = Promise.resolve({mockResult: true});
                cache.captureTask('mockTask', promise);

                // WHEN a task is retrieved
                const taskPromise = cache.getTaskPromise('mockTask');

                // THEN it should resolve with the same result as the captured task
                return taskPromise.then((result) => {
                    expect(result).toEqual({mockResult: true});
                });
            });
        });
    });

    describe('Onyx with Cache', () => {
        let Onyx;
        let withOnyx;
        let AsyncStorageMock;

        /** @type OnyxCache */
        let cache;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
            COLLECTION: {
                MOCK_COLLECTION: 'mock_collection_',
            },
        };

        function initOnyx(overrides) {
            const OnyxModule = require('../../lib');
            Onyx = OnyxModule.default;
            withOnyx = OnyxModule.withOnyx;
            AsyncStorageMock = require('@react-native-async-storage/async-storage').default;
            cache = require('../../lib/OnyxCache').default;

            Onyx.init({
                keys: ONYX_KEYS,
                safeEvictionKeys: [ONYX_KEYS.COLLECTION.MOCK_COLLECTION],
                registerStorageEventListener: jest.fn(),
                maxCachedKeysCount: 10,
                ...overrides,
            });

            // Onyx init introduces some side effects e.g. calls the getAllKeys
            // We're clearing mocks to have a fresh calls history
            return waitForPromisesToResolve()
                .then(() => jest.clearAllMocks());
        }

        // Always use a "fresh" instance
        beforeEach(() => {
            jest.resetModules();
            return initOnyx();
        });

        it('Expect a single call to getItem when multiple components use the same key', () => {
            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            return initOnyx()
                .then(() => {
                    // WHEN multiple components are rendered
                    render(
                        <>
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                        </>
                    );
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN Async storage `getItem` should be called only once
                    expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(1);
                });
        });

        it('Expect a single call to getAllKeys when multiple components use the same key', () => {
            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            return initOnyx()
                .then(() => {
                    AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
                    AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);

                    // WHEN multiple components are rendered
                    render(
                        <>
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                            <TestComponentWithOnyx />
                        </>
                    );
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN Async storage `getItem` should be called only once
                    expect(AsyncStorageMock.getAllKeys).toHaveBeenCalledTimes(1);
                });
        });

        it('Should keep recently accessed items in cache', () => {
            // GIVEN Storage with 10 different keys
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue(
                _.range(10).map(number => `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`)
            );
            let connections;

            // GIVEN Onyx is configured with max 5 keys in cache
            return initOnyx({maxCachedKeysCount: 5})
                .then(() => {
                    // GIVEN 10 connections for different keys
                    connections = _.range(10).map((number) => {
                        const key = `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}${number}`;
                        return ({
                            key,
                            connectionId: Onyx.connect({key}),
                        });
                    });
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // WHEN a new connection for a safe eviction key happens
                    Onyx.connect({key: `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}9`});
                })
                .then(() => {
                    // THEN the most recent 5 keys should remain in cache
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
            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);

            return initOnyx()
                .then(() => {
                    // WHEN a component is rendered
                    render(<TestComponentWithOnyx />);
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // WHEN the key was removed from cache
                    cache.drop(ONYX_KEYS.TEST_KEY);
                })

                // THEN When another component using the same storage key is rendered
                .then(() => render(<TestComponentWithOnyx />))
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN Async storage `getItem` should be called twice
                    expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
                });
        });

        it('Expect multiple calls to getItem when multiple keys are used', () => {
            // GIVEN two component
            const TestComponentWithOnyx = withOnyx({
                testObject: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithCollections);

            const AnotherTestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.ANOTHER_TEST,
                },
            })(ViewWithText);

            // GIVEN some values exist in storage
            AsyncStorageMock.setItem(ONYX_KEYS.TEST_KEY, JSON.stringify({ID: 15, data: 'mock object with ID'}));
            AsyncStorageMock.setItem(ONYX_KEYS.ANOTHER_TEST, JSON.stringify('mock text'));
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY, ONYX_KEYS.ANOTHER_TEST]);
            return initOnyx()
                .then(() => {
                    // WHEN the components are rendered multiple times
                    render(<TestComponentWithOnyx />);
                    render(<AnotherTestComponentWithOnyx />);
                    render(<TestComponentWithOnyx />);
                    render(<AnotherTestComponentWithOnyx />);
                    render(<AnotherTestComponentWithOnyx />);
                    render(<TestComponentWithOnyx />);
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN Async storage `getItem` should be called exactly two times (once for each key)
                    expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
                    expect(AsyncStorageMock.getItem.mock.calls).toEqual([
                        [ONYX_KEYS.TEST_KEY],
                        [ONYX_KEYS.ANOTHER_TEST]
                    ]);
                });
        });

        it('Should clean cache when connections to eviction keys happen', () => {
            // GIVEN storage with some data
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue(_.range(1, 10).map(n => `key${n}`));

            jest.useFakeTimers();

            // GIVEN Onyx with LRU size of 3
            return initOnyx({maxCachedKeysCount: 3})
                .then(() => {
                    // WHEN 4 connections for different keys happen
                    Onyx.connect({key: 'key1'});
                    Onyx.connect({key: 'key2'});
                    Onyx.connect({key: 'key3'});
                    Onyx.connect({key: 'key4'});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN keys 1,2,3,4 should be in cache
                    expect(cache.hasCacheForKey('key1')).toBe(true);
                    expect(cache.hasCacheForKey('key2')).toBe(true);
                    expect(cache.hasCacheForKey('key3')).toBe(true);
                    expect(cache.hasCacheForKey('key4')).toBe(true);

                    // WHEN A connection for safe eviction key happens
                    Onyx.connect({key: ONYX_KEYS.COLLECTION.MOCK_COLLECTION});
                })
                .then(waitForPromisesToResolve)
                .then(() => {
                    // THEN key 1 should no longer be in cache
                    expect(cache.hasCacheForKey('key1')).toBe(false);

                    // AND the rest of the keys should be in cache
                    expect(cache.hasCacheForKey('key2')).toBe(true);
                    expect(cache.hasCacheForKey('key3')).toBe(true);
                    expect(cache.hasCacheForKey('key4')).toBe(true);
                });
        });
    });
});
