import React from 'react';
import {render} from '@testing-library/react-native';

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
                cache.update('mockKey', 'mockValue');
                cache.update('mockKey2', 'mockValue');
                cache.update('mockKey3', 'mockValue');

                // THEN the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should keep storage keys even when no values are provided', () => {
                // GIVEN cache with some items
                cache.update('mockKey');
                cache.update('mockKey2');
                cache.update('mockKey3');

                // THEN the keys should be stored in cache
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should not store duplicate keys', () => {
                // GIVEN cache with some items
                cache.update('mockKey', 'mockValue');
                cache.update('mockKey2', 'mockValue');
                cache.update('mockKey3', 'mockValue');

                // WHEN an existing keys is later updated
                cache.update('mockKey2', 'new mock value');

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
                cache.update('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.update('mockKey2', 'mockValue3');

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

            it('Should return cached value when it exists', () => {
                // GIVEN cache with some items
                cache.update('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.update('mockKey2', 'mockValue3');

                // WHEN a value exists in cache
                // THEN it should return true
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.hasCacheForKey('mockKey2')).toBe(true);
            });
        });

        describe('update', () => {
            it('Should add data to cache when both key and value are provided', () => {
                // GIVEN empty cache

                // WHEN update is called with key and value
                cache.update('mockKey', {value: 'mockValue'});

                // THEN data should be cached
                expect(cache.getValue('mockKey')).toEqual({value: 'mockValue'});
            });

            it('Should only store the key when no value is provided', () => {
                // GIVEN empty cache

                // WHEN update is called with key and value
                cache.update('mockKey');

                // THEN there should be no cached value
                expect(cache.getValue('mockKey')).not.toBeDefined();

                // THEN but a key should be available
                expect(cache.getAllKeys()).toEqual(expect.arrayContaining(['mockKey']));
            });

            it('Should overwrite existing cache items for the given key', () => {
                // GIVEN cache with some items
                cache.update('mockKey', {value: 'mockValue'});
                cache.update('mockKey2', {other: 'otherMockValue'});

                // WHEN update is called for an existing key
                cache.update('mockKey2', {value: []});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey2')).toEqual({value: []});
            });
        });

        describe('remove', () => {
            it('Should remove the key from all keys', () => {
                // GIVEN cache with some items
                cache.update('mockKey', 'mockValue');
                cache.update('mockKey2', 'mockValue');
                cache.update('mockKey3', 'mockValue');

                // WHEN an key is removed
                cache.remove('mockKey2');

                // THEN getAllKeys should not include the removed value
                const allKeys = cache.getAllKeys();
                expect(allKeys).toEqual(['mockKey', 'mockKey3']);
            });

            it('Should remove the key from cache', () => {
                // GIVEN cache with some items
                cache.update('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.update('mockKey2', 'mockValue3');

                // WHEN a key is removed
                cache.remove('mockKey');

                // THEN a value should not be available in cache
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
                expect(cache.getValue('mockKey')).not.toBeDefined();
            });
        });

        describe('merge', () => {
            it('Should create the value in cache when it does not exist', () => {
                // GIVEN empty cache

                // WHEN merge is called with key value pairs
                cache.merge([
                    ['mockKey', {value: 'mockValue'}],
                    ['mockKey2', {value: 'mockValue2'}],
                ]);

                // THEN data should be created in cache
                expect(cache.getValue('mockKey')).toEqual({value: 'mockValue'});
                expect(cache.getValue('mockKey2')).toEqual({value: 'mockValue2'});
            });

            it('Should merge data to existing cache value', () => {
                // GIVEN cache with some items
                cache.update('mockKey', {value: 'mockValue'});
                cache.update('mockKey2', {other: 'otherMockValue', mock: 'mock'});

                // WHEN merge is called with key value pairs
                cache.merge([
                    ['mockKey', {mockItems: []}],
                    ['mockKey2', {items: [1, 2], other: 'overwrittenMockValue'}]
                ]);

                // THEN the values should be merged together in cache
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

            it('Should throw when the value parameter is not an object or array', () => {
                // GIVEN cache with some items
                cache.update('mockKey', 'someStringValue');

                const badMergeValue = [['mockKey', 'usually we do not want to merge strings right?']];

                // WHEN merge is not called with array or an object
                expect(() => cache.merge(badMergeValue)).toThrow('The provided merge value is invalid');
            });
        });

        describe('resolveTask', () => {
            it('Should start a new task when no pending task exists', () => {
                // GIVEN empty cache and a function returning a promise
                const task = jest.fn().mockResolvedValue({data: 'mockData'});

                // WHEN resolve task is called with this task
                cache.resolveTask('mockTask', task);

                // THEN the task should be triggered
                expect(task).toHaveBeenCalledTimes(1);
            });

            it('Should not start a task again when it is already captured and running', () => {
                // GIVEN cache that have captured a promise for a pending task
                const task = jest.fn().mockResolvedValue({data: 'mockData'});
                cache.resolveTask('mockTask', task);
                task.mockClear();

                // WHEN a function tries to run the same task
                cache.resolveTask('mockTask', task);
                cache.resolveTask('mockTask', task);
                cache.resolveTask('mockTask', task);

                // THEN the task should not have been called again
                expect(task).not.toHaveBeenCalled();
            });

            it('Should start a new task when a previous task was completed and removed', async () => {
                // GIVEN cache that have captured a promise for a pending task
                const task = jest.fn().mockResolvedValue({data: 'mockData'});
                cache.resolveTask('mockTask', task);
                task.mockClear();

                // WHEN the task is completed
                await waitForPromisesToResolve();

                // WHEN a function tries to run the same task
                cache.resolveTask('mockTask', task);

                // THEN a new task should be started
                expect(task).toHaveBeenCalledTimes(1);
            });

            it('Should resolve all tasks with the same result', () => {
                // GIVEN empty cache and a function returning a promise
                const task = jest.fn().mockResolvedValue({data: 'mockData'});

                // WHEN multiple tasks are executed at the same time
                const promise1 = cache.resolveTask('mockTask', task);
                const promise2 = cache.resolveTask('mockTask', task);
                const promise3 = cache.resolveTask('mockTask', task);

                // THEN they all should have the same result
                Promise.all([promise1, promise2, promise3])
                    .then(([result1, result2, result3]) => {
                        expect(result1).toEqual({data: 'mockData'});
                        expect(result2).toEqual({data: 'mockData'});
                        expect(result3).toEqual({data: 'mockData'});
                    });
            });
        });
    });

    describe('Onyx with Cache', () => {
        let Onyx;
        let withOnyx;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
            COLLECTION: {
                MOCK_COLLECTION: 'mock_collection_',
            },
        };

        async function initOnyx() {
            const OnyxModule = require('../../index');
            Onyx = OnyxModule.default;
            withOnyx = OnyxModule.withOnyx;

            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });

            // Onyx init introduces some side effects e.g. calls the getAllKeys
            // We're clearing to have a fresh mock calls history
            await waitForPromisesToResolve();
            jest.clearAllMocks();
        }

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            return initOnyx();
        });

        it('Expect a single call to AsyncStorage.getItem when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            await initOnyx();

            // WHEN multiple components are rendered
            render(
                <>
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                </>
            );

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(1);
        });

        it('Expect a single call to AsyncStorage.getAllKeys when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            await initOnyx();
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

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getAllKeys).toHaveBeenCalledTimes(1);
        });

        it('Expect multiple calls to AsyncStorage.getItem when no existing component is using a key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            await initOnyx();

            // WHEN a component is rendered and unmounted and no longer available
            const result = render(<TestComponentWithOnyx />);
            await waitForPromisesToResolve();
            result.unmount();
            await waitForPromisesToResolve();

            // THEN When another component using the same storage key is rendered
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called twice
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
        });

        it('Expect multiple calls to AsyncStorage.getItem when multiple keys are used', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

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
            await initOnyx();

            // WHEN the components are rendered multiple times
            render(<TestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<TestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called exactly two times (once for each key)
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
            expect(AsyncStorageMock.getItem.mock.calls).toEqual([
                [ONYX_KEYS.TEST_KEY],
                [ONYX_KEYS.ANOTHER_TEST]
            ]);
        });
    });
});
