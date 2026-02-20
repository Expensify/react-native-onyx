import lodashClone from 'lodash/clone';
import lodashCloneDeep from 'lodash/cloneDeep';
import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import * as Logger from '../../lib/Logger';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import OnyxUtils from '../../lib/OnyxUtils';
import type OnyxCache from '../../lib/OnyxCache';
import StorageMock from '../../lib/storage';
import type {OnyxCollection, OnyxKey, OnyxUpdate} from '../../lib/types';
import type {GenericDeepRecord} from '../types';
import type GenericCollection from '../utils/GenericCollection';
import type {Connection} from '../../lib/OnyxConnectionManager';
import createDeferredTask from '../../lib/createDeferredTask';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    // Special case: this key is not a collection key, but it has an underscore in its name
    KEY_WITH_UNDERSCORE: 'nvp_test',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_CONNECT_COLLECTION: 'testConnectCollection_',
        TEST_POLICY: 'testPolicy_',
        TEST_UPDATE: 'testUpdate_',
        PEOPLE: 'people_',
        ANIMALS: 'animals_',
        SNAPSHOT: 'snapshot_',
        ROUTES: 'routes_',
        RAM_ONLY_COLLECTION: 'ramOnlyCollection_',
    },
    RAM_ONLY_TEST_KEY: 'ramOnlyKey',
    RAM_ONLY_WITH_INITIAL_VALUE: 'ramOnlyWithInitialValue',
};

describe('Onyx', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYX_KEYS,
            initialKeyStates: {
                [ONYX_KEYS.OTHER_TEST]: 42,
                [ONYX_KEYS.KEY_WITH_UNDERSCORE]: 'default',
                [ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE]: 'default',
            },
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
            skippableCollectionMemberIDs: ['skippable-id'],
            snapshotMergeKeys: ['pendingAction', 'pendingFields'],
        });
    });

    let connection: Connection | undefined;

    let cache: typeof OnyxCache;

    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;
    });

    afterEach(() => {
        if (connection) {
            Onyx.disconnect(connection);
        }
        return Onyx.clear();
    });

    it('should remove key value from OnyxCache/Storage when set is called with null value', () =>
        Onyx.set(ONYX_KEYS.OTHER_TEST, 42)
            .then(() => OnyxUtils.getAllKeys())
            .then((keys) => {
                expect(keys.has(ONYX_KEYS.OTHER_TEST)).toBe(true);
                return Onyx.set(ONYX_KEYS.OTHER_TEST, null);
            })
            // Checks if cache value is removed.
            .then(() => {
                expect(cache.get(ONYX_KEYS.OTHER_TEST)).toBeUndefined();
                return OnyxUtils.getAllKeys();
            })
            .then((keys) => {
                expect(keys.has(ONYX_KEYS.OTHER_TEST)).toBe(false);
            }));

    it('should restore a key with initial state if the key was set to null and Onyx.clear() is called', () =>
        Onyx.set(ONYX_KEYS.OTHER_TEST, 42)
            .then(() => Onyx.set(ONYX_KEYS.OTHER_TEST, null))
            .then(() => Onyx.clear())
            .then(() => {
                expect(cache.get(ONYX_KEYS.OTHER_TEST)).toBe(42);
            }));

    it('should set a simple key', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        // Set a simple key
        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test').then(() => {
            expect(testKeyValue).toBe('test');
        });
    });

    it('should not set the key if the value is incompatible (array vs object)', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, ['test'])
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
                return Onyx.set(ONYX_KEYS.TEST_KEY, {test: 'test'});
            })
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
            });
    });

    it("shouldn't call a connection twice when setting a value", () => {
        const mockCallback = jest.fn();

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            callback: mockCallback,
            // True is the default, just setting it here to be explicit
            initWithStoredValues: true,
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test').then(() => {
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });

    it('should merge an object with another object', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: 'test1'})
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
                return Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1', test2: 'test2'});
            });
    });

    it('should not merge if the value is incompatible (array vs object)', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.merge(ONYX_KEYS.TEST_KEY, ['test'])
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
                return Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
            })
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
            });
    });

    it('should notify subscribers when data has been cleared', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        const mockCallback = jest.fn();
        const otherTestConnection = Onyx.connect({
            key: ONYX_KEYS.OTHER_TEST,
            callback: mockCallback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                expect(mockCallback).toHaveBeenCalledTimes(1);
                expect(mockCallback).toHaveBeenCalledWith(42, ONYX_KEYS.OTHER_TEST);
                mockCallback.mockClear();
            })
            .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, 'test'))
            .then(() => {
                expect(testKeyValue).toBe('test');
                return Onyx.clear();
            })
            .then(() => waitForPromisesToResolve())
            .then(() => {
                // Test key should be cleared
                expect(testKeyValue).toBeUndefined();

                // Expect that the connection to a key with a default value that wasn't changed is not called on clear
                expect(mockCallback).toHaveBeenCalledTimes(0);

                return Onyx.disconnect(otherTestConnection);
            });
    });

    it('should notify key subscribers that use a underscore in their name', () => {
        const mockCallback = jest.fn();
        connection = Onyx.connect({
            key: ONYX_KEYS.KEY_WITH_UNDERSCORE,
            callback: mockCallback,
        });

        return waitForPromisesToResolve()
            .then(() => mockCallback.mockReset())
            .then(() => Onyx.set(ONYX_KEYS.KEY_WITH_UNDERSCORE, 'test'))
            .then(() => {
                expect(mockCallback).toHaveBeenCalledTimes(1);
                expect(mockCallback).toHaveBeenLastCalledWith('test', ONYX_KEYS.KEY_WITH_UNDERSCORE);
                mockCallback.mockReset();
                return Onyx.clear();
            })
            .then(() => {
                expect(mockCallback).toHaveBeenCalledTimes(1);
                expect(mockCallback).toHaveBeenCalledWith('default', ONYX_KEYS.KEY_WITH_UNDERSCORE);
            })
            .then(() => Onyx.set(ONYX_KEYS.KEY_WITH_UNDERSCORE, 'default'))
            .then(() => mockCallback.mockReset())
            .then(() => Onyx.set(ONYX_KEYS.KEY_WITH_UNDERSCORE, 'test'))
            .then(() => {
                expect(mockCallback).toHaveBeenCalledTimes(1);
                expect(mockCallback).toHaveBeenCalledWith('test', ONYX_KEYS.KEY_WITH_UNDERSCORE);
            });
    });

    it('should not notify subscribers after they have disconnected', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
                if (connection) {
                    Onyx.disconnect(connection);
                }
                return Onyx.set(ONYX_KEYS.TEST_KEY, 'test updated');
            })
            .then(() => {
                // Test value has not changed
                expect(testKeyValue).toBe('test');
            });
    });

    it('should merge arrays by replacing previous value with new value', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, ['test1'])
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test1']);
                return Onyx.merge(ONYX_KEYS.TEST_KEY, ['test2', 'test3', 'test4']);
            })
            .then(waitForPromisesToResolve)
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test2', 'test3', 'test4']);
            });
    });

    it('should merge 2 objects when it has no initial stored value for test key', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(ONYX_KEYS.TEST_KEY, {test1: 'test1'});
        return Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'}).then(() => {
            expect(testKeyValue).toStrictEqual({test1: 'test1', test2: 'test2'});
        });
    });

    it('should merge 2 arrays when it has no initial stored value for test key', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(ONYX_KEYS.TEST_KEY, ['test1']);
        return Onyx.merge(ONYX_KEYS.TEST_KEY, ['test2']).then(() => {
            expect(testKeyValue).toEqual(['test2']);
        });
    });

    it('should remove keys that are set to null when merging', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {
            test1: {
                test2: 'test2',
                test3: {
                    test4: 'test4',
                },
            },
        })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: {
                        test2: 'test2',
                        test3: {
                            test4: 'test4',
                        },
                    },
                });

                return Onyx.merge(ONYX_KEYS.TEST_KEY, {
                    test1: {
                        test3: {
                            test4: null,
                        },
                    },
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: {
                        test2: 'test2',
                        test3: {},
                    },
                });

                return Onyx.merge(ONYX_KEYS.TEST_KEY, {
                    test1: {
                        test3: null,
                    },
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: {test2: 'test2'}});

                return Onyx.merge(ONYX_KEYS.TEST_KEY, {test1: null});
            })
            .then(() => {
                expect(testKeyValue).toEqual({});
            });
    });

    it('should ignore top-level and remove nested `undefined` values in Onyx.set', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {
            test1: {
                test2: 'test2',
                test3: 'test3',
            },
        })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: {
                        test2: 'test2',
                        test3: 'test3',
                    },
                });

                return Onyx.set(ONYX_KEYS.TEST_KEY, {
                    test1: {
                        test2: undefined,
                        test3: 'test3',
                    },
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: {test3: 'test3'}});

                return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: undefined});
            })
            .then(() => {
                expect(testKeyValue).toEqual({});

                return Onyx.set(ONYX_KEYS.TEST_KEY, undefined);
            })
            .then(() => {
                expect(testKeyValue).toEqual({});

                return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: undefined});
            });
    });

    it('should ignore top-level and remove nested `undefined` values in Onyx.multiSet', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        let otherTestKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.OTHER_TEST,
            initWithStoredValues: false,
            callback: (value) => {
                otherTestKeyValue = value;
            },
        });

        return Onyx.multiSet({
            [ONYX_KEYS.TEST_KEY]: {
                test1: 'test1',
                test2: 'test2',
            },
            [ONYX_KEYS.OTHER_TEST]: 'otherTest',
        })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: 'test1',
                    test2: 'test2',
                });
                expect(otherTestKeyValue).toEqual('otherTest');

                return Onyx.multiSet({
                    [ONYX_KEYS.TEST_KEY]: {
                        test1: 'test1',
                        test2: undefined,
                    },
                    [ONYX_KEYS.OTHER_TEST]: undefined,
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: 'test1',
                });
                expect(otherTestKeyValue).toEqual('otherTest');

                return Onyx.multiSet({
                    [ONYX_KEYS.TEST_KEY]: null,
                    [ONYX_KEYS.OTHER_TEST]: null,
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual(undefined);
                expect(otherTestKeyValue).toEqual(undefined);
            });
    });

    it('should ignore top-level and remove nested `undefined` values in Onyx.merge', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {
            test1: {
                test2: 'test2',
                test3: 'test3',
            },
        })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: {
                        test2: 'test2',
                        test3: 'test3',
                    },
                });
                return Onyx.merge(ONYX_KEYS.TEST_KEY, {
                    test1: {
                        test2: undefined,
                    },
                });
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: {test2: 'test2', test3: 'test3'}});
                return Onyx.merge(ONYX_KEYS.TEST_KEY, {test1: undefined});
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: {test2: 'test2', test3: 'test3'}});
                return Onyx.merge(ONYX_KEYS.TEST_KEY, undefined);
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: {test2: 'test2', test3: 'test3'}});
            });
    });

    it('should ignore top-level and remove nested `undefined` values in Onyx.mergeCollection', () => {
        let result: OnyxCollection<unknown>;

        const routineRoute = `${ONYX_KEYS.COLLECTION.TEST_KEY}routine`;
        const holidayRoute = `${ONYX_KEYS.COLLECTION.TEST_KEY}holiday`;
        const workRoute = `${ONYX_KEYS.COLLECTION.TEST_KEY}work`;

        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => (result = value),
            waitForCollectionCallback: true,
        });

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [routineRoute]: {
                waypoints: {
                    1: 'Home',
                    2: 'Work',
                    3: undefined,
                },
            },
            [holidayRoute]: {
                waypoints: undefined,
            },
            [workRoute]: undefined,
        } as GenericCollection).then(() => {
            expect(result).toEqual({
                [routineRoute]: {
                    waypoints: {
                        1: 'Home',
                        2: 'Work',
                    },
                },
                [holidayRoute]: {},
                [workRoute]: undefined,
            });
        });
    });

    it('should overwrite an array key nested inside an object', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(ONYX_KEYS.TEST_KEY, {something: [1, 2, 3]});
        return Onyx.merge(ONYX_KEYS.TEST_KEY, {something: [4]}).then(() => {
            expect(testKeyValue).toEqual({something: [4]});
        });
    });

    it('should overwrite an array key nested inside an object when using merge on a collection', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        Onyx.merge(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {something: [1, 2, 3]}});
        return Onyx.merge(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {something: [4]}}).then(() => {
            expect(testKeyValue).toEqual({test_1: {something: [4]}});
        });
    });

    it('should properly set and merge when using mergeCollection', () => {
        const valuesReceived: Record<string, unknown> = {};
        const mockCallback = jest.fn((data) => (valuesReceived[data.ID] = data.value));
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: mockCallback,
        });

        // The first time we call mergeCollection we'll be doing a multiSet internally
        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: {
                ID: 123,
                value: 'one',
            },
            test_2: {
                ID: 234,
                value: 'two',
            },
            test_3: {
                ID: 345,
                value: 'three',
            },
        } as GenericCollection)
            .then(() =>
                // 2 key values to update and 2 new keys to add.
                // MergeCollection will perform a mix of multiSet and multiMerge
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {
                        ID: 123,
                        value: 'five',
                    },
                    test_2: {
                        ID: 234,
                        value: 'four',
                    },
                    test_3: ['abc', 'xyz'], // This shouldn't be merged since it's an array, and the original value is an object {ID, value}
                    test_4: {
                        ID: 456,
                        value: 'two',
                    },
                    test_5: {
                        ID: 567,
                        value: 'one',
                    },
                } as GenericCollection),
            )
            .then(() => {
                // 3 items on the first mergeCollection + 4 items the next mergeCollection
                expect(mockCallback).toHaveBeenCalledTimes(7);
                expect(mockCallback).toHaveBeenNthCalledWith(1, {ID: 123, value: 'one'}, 'test_1');
                expect(mockCallback).toHaveBeenNthCalledWith(2, {ID: 234, value: 'two'}, 'test_2');
                expect(mockCallback).toHaveBeenNthCalledWith(3, {ID: 345, value: 'three'}, 'test_3');
                expect(mockCallback).toHaveBeenNthCalledWith(4, {ID: 123, value: 'five'}, 'test_1');
                expect(mockCallback).toHaveBeenNthCalledWith(5, {ID: 234, value: 'four'}, 'test_2');
                expect(mockCallback).toHaveBeenNthCalledWith(6, {ID: 456, value: 'two'}, 'test_4');
                expect(mockCallback).toHaveBeenNthCalledWith(7, {ID: 567, value: 'one'}, 'test_5');
                expect(valuesReceived[123]).toEqual('five');
                expect(valuesReceived[234]).toEqual('four');
                expect(valuesReceived[345]).toEqual('three');
                expect(valuesReceived[456]).toEqual('two');
                expect(valuesReceived[567]).toEqual('one');
            });
    });

    it('should skip the update when a key not belonging to collection key is present in mergeCollection', () => {
        const valuesReceived: Record<string, unknown> = {};
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (data, key) => (valuesReceived[key] = data),
        });

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, notMyTest: {beep: 'boop'}} as GenericCollection).then(() => {
            expect(valuesReceived).toEqual({});
        });
    });

    it('should return full object to callback when calling mergeCollection()', () => {
        const valuesReceived: Record<string, unknown> = {};
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (data, key) => (valuesReceived[key] = data),
        });

        return Onyx.multiSet({
            test_1: {
                existingData: 'test',
            },
            test_2: {
                existingData: 'test',
            },
        })
            .then(() =>
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {
                        ID: 123,
                        value: 'one',
                    },
                    test_2: {
                        ID: 234,
                        value: 'two',
                    },
                } as GenericCollection),
            )
            .then(() => {
                expect(valuesReceived).toEqual({
                    test_1: {
                        ID: 123,
                        value: 'one',
                        existingData: 'test',
                    },
                    test_2: {
                        ID: 234,
                        value: 'two',
                        existingData: 'test',
                    },
                });
            });
    });

    it('should only trigger collection callback once when mergeCollection is called', async () => {
        const mockCallback = jest.fn();
        const key1 = `${ONYX_KEYS.COLLECTION.TEST_KEY}1`;
        const key2 = `${ONYX_KEYS.COLLECTION.TEST_KEY}2`;
        const key3 = `${ONYX_KEYS.COLLECTION.TEST_KEY}3`;

        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });

        await waitForPromisesToResolve();
        expect(mockCallback).toHaveBeenCalledTimes(1);
        mockCallback.mockClear();

        // Call mergeCollection with multiple items
        await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [key1]: {id: '1', name: 'Item 1'},
            [key2]: {id: '2', name: 'Item 2'},
            [key3]: {id: '3', name: 'Item 3'},
        } as GenericCollection);

        // Should only be called once
        expect(mockCallback).toHaveBeenCalledTimes(1);

        // Should receive the entire merged collection
        const receivedData = mockCallback.mock.calls[0][0];
        expect(receivedData).toEqual(
            expect.objectContaining({
                [key1]: {id: '1', name: 'Item 1'},
                [key2]: {id: '2', name: 'Item 2'},
                [key3]: {id: '3', name: 'Item 3'},
            }),
        );
    });

    it('should only trigger collection callback once when mergeCollection is called with null values', async () => {
        const mockCallback = jest.fn();
        const key1 = `${ONYX_KEYS.COLLECTION.TEST_KEY}1`;
        const key2 = `${ONYX_KEYS.COLLECTION.TEST_KEY}2`;
        const key3 = `${ONYX_KEYS.COLLECTION.TEST_KEY}3`;

        // Set up initial data
        await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [key1]: {id: '1', name: 'Item 1'},
            [key2]: {id: '2', name: 'Item 2'},
            [key3]: {id: '3', name: 'Item 3'},
        } as GenericCollection);

        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });

        await waitForPromisesToResolve();
        expect(mockCallback).toHaveBeenCalledTimes(1);
        mockCallback.mockClear();

        // Call mergeCollection with mixed null and data values
        await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [key1]: null,
            [key2]: {id: '2', name: 'Updated Item 2'},
            [key3]: null,
        } as GenericCollection);

        // Should only be called once
        expect(mockCallback).toHaveBeenCalledTimes(1);

        // Should receive filtered collection
        const receivedData = mockCallback.mock.calls[0][0];
        expect(receivedData).toEqual({
            [key2]: {id: '2', name: 'Updated Item 2'},
        });

        // Verify removed items are not present
        expect(receivedData[key1]).toBeUndefined();
        expect(receivedData[key3]).toBeUndefined();
    });

    it('should use update data object to set/merge keys', () => {
        let testKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        let otherTestKeyValue: unknown;
        connection = Onyx.connect({
            key: ONYX_KEYS.OTHER_TEST,
            initWithStoredValues: false,
            callback: (value) => {
                otherTestKeyValue = value;
            },
        });

        return waitForPromisesToResolve()
            .then(() => {
                // Given the initial Onyx state: {test: true, otherTest: {test1: 'test1'}}
                Onyx.set(ONYX_KEYS.TEST_KEY, true);
                Onyx.set(ONYX_KEYS.OTHER_TEST, {test1: 'test1'});
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toBe(true);
                expect(otherTestKeyValue).toEqual({test1: 'test1'});

                // When we pass a data object to Onyx.update
                return Onyx.update([
                    {
                        onyxMethod: 'set',
                        key: ONYX_KEYS.TEST_KEY,
                        value: 'one',
                    },
                    {
                        onyxMethod: 'merge',
                        key: ONYX_KEYS.OTHER_TEST,
                        value: {test2: 'test2'},
                    },
                ]);
            })
            .then(() => {
                // Then the final Onyx state should be {test: 'one', otherTest: {test1: 'test1', test2: 'test2'}}
                expect(testKeyValue).toBe('one');
                expect(otherTestKeyValue).toEqual({test1: 'test1', test2: 'test2'});
            });
    });

    it('should use update data object to merge a collection of keys', () => {
        const valuesReceived: Record<string, unknown> = {};
        const mockCallback = jest.fn((data) => (valuesReceived[data.ID] = data.value));
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: mockCallback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                // Given the initial Onyx state: {test_1: {existingData: 'test',}, test_2: {existingData: 'test',}}
                Onyx.multiSet({
                    test_1: {
                        existingData: 'test',
                    },
                    test_2: {
                        existingData: 'test',
                    },
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(mockCallback).toHaveBeenNthCalledWith(1, {existingData: 'test'}, 'test_1');
                expect(mockCallback).toHaveBeenNthCalledWith(2, {existingData: 'test'}, 'test_2');

                // When we pass a mergeCollection data object to Onyx.update
                return Onyx.update([
                    {
                        onyxMethod: 'mergecollection',
                        key: ONYX_KEYS.COLLECTION.TEST_KEY,
                        value: {
                            test_1: {
                                ID: 123,
                                value: 'one',
                            },
                            test_2: {
                                ID: 234,
                                value: 'two',
                            },
                            test_3: {
                                ID: 345,
                                value: 'three',
                            },
                        } as GenericCollection,
                    },
                ]);
            })
            .then(() => {
                /* Then the final Onyx state should be:
                    {
                        test_1: {
                            existingData: 'test'
                            ID: 123,
                            value: 'one',
                        },
                        test_2: {
                            existingData: 'test'
                            ID: 234,
                            value: 'two',
                        },
                        test_3: {
                            ID: 345,
                            value: 'three',
                        },
                    }
                */

                expect(mockCallback).toHaveBeenNthCalledWith(3, {ID: 123, value: 'one', existingData: 'test'}, 'test_1');
                expect(mockCallback).toHaveBeenNthCalledWith(4, {ID: 234, value: 'two', existingData: 'test'}, 'test_2');
                expect(mockCallback).toHaveBeenNthCalledWith(5, {ID: 345, value: 'three'}, 'test_3');
            });
    });

    it('should properly set all keys provided in a multiSet called via update', () => {
        const valuesReceived: Record<string, unknown> = {};
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (data, key) => (valuesReceived[key] = data),
        });

        return Onyx.multiSet({
            test_1: {
                existingData: 'test',
            },
            test_2: {
                existingData: 'test',
            },
        })
            .then(() =>
                Onyx.update([
                    {
                        onyxMethod: 'multiset',
                        value: {
                            test_1: {
                                ID: 123,
                                value: 'one',
                            },
                            test_2: {
                                ID: 234,
                                value: 'two',
                            },
                        },
                    },
                ] as unknown as Array<OnyxUpdate<OnyxKey>>),
            )
            .then(() => {
                expect(valuesReceived).toEqual({
                    test_1: {
                        ID: 123,
                        value: 'one',
                    },
                    test_2: {
                        ID: 234,
                        value: 'two',
                    },
                });
            });
    });

    it('should return all collection keys as a single object when waitForCollectionCallback = true', () => {
        const mockCallback = jest.fn();

        // Given some initial collection data
        const initialCollectionData = {
            testConnectCollection_1: {
                ID: 123,
                value: 'one',
            },
            testConnectCollection_2: {
                ID: 234,
                value: 'two',
            },
            testConnectCollection_3: {
                ID: 345,
                value: 'three',
            },
        };

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION, initialCollectionData as GenericCollection)
            .then(() => {
                // When we connect to that collection with waitForCollectionCallback = true
                connection = Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION,
                    waitForCollectionCallback: true,
                    callback: mockCallback,
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // Then we expect the callback to be called only once and the initial stored value to be initialCollectionData
                expect(mockCallback).toHaveBeenCalledTimes(1);
                expect(mockCallback).toHaveBeenCalledWith(initialCollectionData, ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION, undefined);
            });
    });

    it('should return all collection keys as a single object when updating a collection key with waitForCollectionCallback = true', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            testPolicy_1: {ID: 234, value: 'one'},
            testPolicy_2: {ID: 123, value: 'two'},
        };

        // Given an Onyx.connect call with waitForCollectionCallback=true
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When mergeCollection is called with an updated collection
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate as GenericCollection))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // AND the value for the first call should be null since the collection was not initialized at that point
                    expect(mockCallback).toHaveBeenNthCalledWith(1, undefined, ONYX_KEYS.COLLECTION.TEST_POLICY, undefined);

                    // AND the value for the second call should be collectionUpdate since the collection was updated
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate, ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate);
                })
        );
    });

    it('should send a value to Onyx.connect() when subscribing to a specific collection member key and keysChanged() is called', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            testPolicy_1: {ID: 234, value: 'one'},
            testPolicy_2: {ID: 123, value: 'two'},
        };

        // Given an Onyx.connect call with waitForCollectionCallback=false
        connection = Onyx.connect({
            key: `${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When mergeCollection is called with an updated collection
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate as GenericCollection))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // AND the value for the first call should be null since the collection was not initialized at that point
                    expect(mockCallback).toHaveBeenNthCalledWith(1, undefined, undefined);

                    // AND the value for the second call should be collectionUpdate since the collection was updated
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate.testPolicy_1, 'testPolicy_1');
                })
        );
    });

    it('should return all collection keys as a single object for subscriber using waitForCollectionCallback when a single collection member key is updated', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            testPolicy_1: {ID: 234, value: 'one'},
        };

        // Given an Onyx.connect call with waitForCollectionCallback=true
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When mergeCollection is called with an updated collection
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // AND the value for the second call should be collectionUpdate
                    expect(mockCallback).toHaveBeenNthCalledWith(1, undefined, ONYX_KEYS.COLLECTION.TEST_POLICY, undefined);
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate, ONYX_KEYS.COLLECTION.TEST_POLICY, {
                        [`${ONYX_KEYS.COLLECTION.TEST_POLICY}1`]: collectionUpdate.testPolicy_1,
                    });
                })
        );
    });

    it('should return a promise when set() called with the same value and there is no change', () => {
        const promiseOne = Onyx.set('test', 'pizza');
        expect(promiseOne).toBeInstanceOf(Promise);
        return promiseOne.then(() => {
            const promiseTwo = Onyx.set('test', 'pizza');
            expect(promiseTwo).toBeInstanceOf(Promise);
        });
    });

    it('should not update a subscriber if the value in the cache has not changed at all', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            testPolicy_1: {ID: 234, value: 'one'},
        };

        // Given an Onyx.connect call with waitForCollectionCallback=true
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When merge is called with an updated collection
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // And the value for the second call should be collectionUpdate
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate, ONYX_KEYS.COLLECTION.TEST_POLICY, {testPolicy_1: collectionUpdate.testPolicy_1});
                })

                // When merge is called again with the same collection not modified
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we should not expect another invocation of the callback
                    expect(mockCallback).toHaveBeenCalledTimes(2);
                })

                // When merge is called again with an object of equivalent value but not the same reference
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, lodashClone(collectionUpdate.testPolicy_1)))
                .then(() => {
                    // Then we should not expect another invocation of the callback
                    expect(mockCallback).toHaveBeenCalledTimes(2);
                })
        );
    });

    it('should update subscriber if the value in the cache has not changed at all but initWithStoredValues === false', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            testPolicy_1: {ID: 234, value: 'one'},
        };

        // Given an Onyx.connect call with waitForCollectionCallback=true
        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
            initWithStoredValues: false,
        });
        return (
            waitForPromisesToResolve()
                // When merge is called with an updated collection
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we expect the callback to have called once. 0 times the initial connect call + 1 time for the merge()
                    expect(mockCallback).toHaveBeenCalledTimes(1);

                    // And the value for the second call should be collectionUpdate
                    expect(mockCallback).toHaveBeenNthCalledWith(1, collectionUpdate, ONYX_KEYS.COLLECTION.TEST_POLICY, {testPolicy_1: collectionUpdate.testPolicy_1});
                })

                // When merge is called again with the same collection not modified
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we should expect another invocation of the callback because initWithStoredValues = false
                    expect(mockCallback).toHaveBeenCalledTimes(2);
                })

                // When merge is called again with an object of equivalent value but not the same reference
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, lodashClone(collectionUpdate.testPolicy_1)))
                .then(() => {
                    // Then we should expect another invocation of the callback because initWithStoredValues = false
                    expect(mockCallback).toHaveBeenCalledTimes(3);
                })
        );
    });

    it('should return a promise that completes when all update() operations are done', () => {
        const connections: Connection[] = [];

        const testCallback = jest.fn();
        const otherTestCallback = jest.fn();
        const collectionCallback = jest.fn();
        const itemKey = `${ONYX_KEYS.COLLECTION.TEST_UPDATE}1`;

        connections.push(Onyx.connect({key: ONYX_KEYS.TEST_KEY, callback: testCallback}));
        connections.push(Onyx.connect({key: ONYX_KEYS.OTHER_TEST, callback: otherTestCallback}));
        connections.push(Onyx.connect({key: ONYX_KEYS.COLLECTION.TEST_UPDATE, callback: collectionCallback, waitForCollectionCallback: true}));
        return waitForPromisesToResolve().then(() =>
            Onyx.update([
                {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.TEST_KEY, value: 'taco'},
                {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.OTHER_TEST, value: 'pizza'},
                {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYX_KEYS.COLLECTION.TEST_UPDATE, value: {[itemKey]: {a: 'a'}} as GenericCollection},
            ]).then(() => {
                expect(collectionCallback).toHaveBeenCalledTimes(2);
                expect(collectionCallback).toHaveBeenNthCalledWith(1, undefined, ONYX_KEYS.COLLECTION.TEST_UPDATE, undefined);
                expect(collectionCallback).toHaveBeenNthCalledWith(2, {[itemKey]: {a: 'a'}}, ONYX_KEYS.COLLECTION.TEST_UPDATE, {[itemKey]: {a: 'a'}});

                expect(testCallback).toHaveBeenCalledTimes(2);
                expect(testCallback).toHaveBeenNthCalledWith(1, undefined, undefined);
                expect(testCallback).toHaveBeenNthCalledWith(2, 'taco', ONYX_KEYS.TEST_KEY);

                expect(otherTestCallback).toHaveBeenCalledTimes(2);
                // We set an initial value of 42 for ONYX_KEYS.OTHER_TEST in Onyx.init()
                expect(otherTestCallback).toHaveBeenNthCalledWith(1, 42, ONYX_KEYS.OTHER_TEST);
                expect(otherTestCallback).toHaveBeenNthCalledWith(2, 'pizza', ONYX_KEYS.OTHER_TEST);
                for (const id of connections) Onyx.disconnect(id);
            }),
        );
    });

    it('should merge an object with a batch of objects and undefined', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: 'test1'})
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test3: 'test3'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, undefined);
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test4: 'test4'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, undefined);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test1: 'test1',
                    test2: 'test2',
                    test3: 'test3',
                    test4: 'test4',
                });
            });
    });

    it('should merge an object with null and overwrite the value', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: 'test1'})
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, null);
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test3: 'test3'});
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual({
                    test2: 'test2',
                    test3: 'test3',
                });
            });
    });

    it('should merge a key with null and allow subsequent updates', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, 1)
            .then(() => {
                expect(testKeyValue).toEqual(1);
                Onyx.merge(ONYX_KEYS.TEST_KEY, null);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual(undefined);
                return Onyx.merge(ONYX_KEYS.TEST_KEY, 2);
            })
            .then(() => {
                expect(testKeyValue).toEqual(2);
            });
    });

    it('should merge a key after an invalid change is merged', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {})
            .then(() => {
                expect(testKeyValue).toEqual({});
                Onyx.merge(ONYX_KEYS.TEST_KEY, []);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual({});
                return Onyx.merge(ONYX_KEYS.TEST_KEY, {test1: 'test1'});
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
            });
    });

    it("should not set null values in Onyx.merge, when the key doesn't exist yet", () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.merge(ONYX_KEYS.TEST_KEY, {
            waypoints: {
                1: 'Home',
                2: 'Work',
                3: null,
            },
        }).then(() => {
            expect(testKeyValue).toEqual({
                waypoints: {
                    1: 'Home',
                    2: 'Work',
                },
            });
        });
    });
    it('should apply updates in order with Onyx.update', () => {
        let testKeyValue: unknown;

        connection = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {})
            .then(() => {
                expect(testKeyValue).toEqual({});
                Onyx.update([
                    {
                        onyxMethod: 'merge',
                        key: ONYX_KEYS.TEST_KEY,
                        value: {test1: 'test1'},
                    },
                    {
                        onyxMethod: 'set',
                        key: ONYX_KEYS.TEST_KEY,
                        value: null,
                    },
                ]);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toBeUndefined();
            });
    });

    it('mergeCollection should omit nested null values', () => {
        let result: OnyxCollection<unknown>;

        const routineRoute = `${ONYX_KEYS.COLLECTION.TEST_KEY}routine`;
        const holidayRoute = `${ONYX_KEYS.COLLECTION.TEST_KEY}holiday`;

        connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => (result = value),
            waitForCollectionCallback: true,
        });

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            [routineRoute]: {
                waypoints: {
                    1: 'Home',
                    2: 'Work',
                    3: 'Gym',
                },
            },
            [holidayRoute]: {
                waypoints: {
                    1: 'Home',
                    2: 'Beach',
                    3: null,
                },
            },
        } as GenericCollection).then(() => {
            expect(result).toEqual({
                [routineRoute]: {
                    waypoints: {
                        1: 'Home',
                        2: 'Work',
                        3: 'Gym',
                    },
                },
                [holidayRoute]: {
                    waypoints: {
                        1: 'Home',
                        2: 'Beach',
                    },
                },
            });
        });
    });

    it('should not call a collection item subscriber if the value did not change', () => {
        const connections: Connection[] = [];

        const cat = `${ONYX_KEYS.COLLECTION.ANIMALS}cat`;
        const dog = `${ONYX_KEYS.COLLECTION.ANIMALS}dog`;

        const collectionCallback = jest.fn();
        const catCallback = jest.fn();
        const dogCallback = jest.fn();

        connections.push(
            Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ANIMALS,
                callback: collectionCallback,
                waitForCollectionCallback: true,
            }),
        );
        connections.push(Onyx.connect({key: cat, callback: catCallback}));
        connections.push(Onyx.connect({key: dog, callback: dogCallback}));

        const initialValue = {name: 'Fluffy'};

        const collectionDiff: GenericCollection = {
            [cat]: initialValue,
            [dog]: {name: 'Rex'},
        };

        return Onyx.set(cat, initialValue)
            .then(() => {
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ANIMALS, collectionDiff);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(collectionCallback).toHaveBeenCalledTimes(3);
                expect(collectionCallback).toHaveBeenNthCalledWith(1, {[cat]: initialValue}, ONYX_KEYS.COLLECTION.ANIMALS, {[cat]: initialValue});
                expect(collectionCallback).toHaveBeenNthCalledWith(2, {[cat]: initialValue}, ONYX_KEYS.COLLECTION.ANIMALS, undefined);
                expect(collectionCallback).toHaveBeenNthCalledWith(3, collectionDiff, ONYX_KEYS.COLLECTION.ANIMALS, {[cat]: initialValue, [dog]: {name: 'Rex'}});

                // Cat hasn't changed from its original value, expect only the initial connect callback
                expect(catCallback).toHaveBeenCalledTimes(1);

                // Dog was modified, expect the initial connect callback and the mergeCollection callback
                expect(dogCallback).toHaveBeenCalledTimes(2);

                connections.map((id) => Onyx.disconnect(id));
            });
    });

    it('should update Snapshot when its data changed', async () => {
        const cat = `${ONYX_KEYS.COLLECTION.ANIMALS}cat`;
        const snapshot1 = `${ONYX_KEYS.COLLECTION.SNAPSHOT}1`;

        const initialValue = {name: 'Fluffy'};
        const finalValue = {name: 'Kitty'};

        await Onyx.set(cat, initialValue);
        await Onyx.set(snapshot1, {data: {[cat]: initialValue}});

        const callback = jest.fn();

        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.SNAPSHOT,
            callback,
        });

        await waitForPromisesToResolve();

        await Onyx.update([{key: cat, value: finalValue, onyxMethod: Onyx.METHOD.MERGE}]);

        expect(callback).toBeCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(1, {data: {[cat]: initialValue}}, snapshot1);
        expect(callback).toHaveBeenNthCalledWith(2, {data: {[cat]: finalValue}}, snapshot1);
    });

    it('should merge allowlisted keys into Snapshot even if they were missing', async () => {
        const cat = `${ONYX_KEYS.COLLECTION.ANIMALS}cat`;
        const snapshot1 = `${ONYX_KEYS.COLLECTION.SNAPSHOT}1`;

        const initialValue = {name: 'Fluffy'};
        const finalValue = {
            name: 'Kitty',
            pendingAction: 'delete',
            pendingFields: {preview: 'delete'},
            other: 'ignored',
        };

        await Onyx.set(cat, initialValue);
        await Onyx.set(snapshot1, {data: {[cat]: initialValue}});

        const callback = jest.fn();

        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.SNAPSHOT,
            callback,
        });

        await waitForPromisesToResolve();

        await Onyx.update([{key: cat, value: finalValue, onyxMethod: Onyx.METHOD.MERGE}]);

        expect(callback).toBeCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(1, {data: {[cat]: initialValue}}, snapshot1);
        expect(callback).toHaveBeenNthCalledWith(2, {data: {[cat]: {name: 'Kitty', pendingAction: 'delete', pendingFields: {preview: 'delete'}}}}, snapshot1);
    });

    describe('update', () => {
        let logInfoFn = jest.fn();

        beforeEach(() => {
            logInfoFn = jest.fn();
            jest.spyOn(Logger, 'logInfo').mockImplementation(logInfoFn);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should squash all updates of collection-related keys into a single mergeCollection call', () => {
            const connections: Connection[] = [];

            const routineRoute = `${ONYX_KEYS.COLLECTION.ROUTES}routine`;
            const holidayRoute = `${ONYX_KEYS.COLLECTION.ROUTES}holiday`;

            const routesCollectionCallback = jest.fn();
            connections.push(
                Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.ROUTES,
                    callback: routesCollectionCallback,
                    waitForCollectionCallback: true,
                }),
            );

            return Onyx.update([
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: routineRoute,
                    value: {
                        waypoints: {
                            1: 'Home',
                            2: 'Work',
                            3: 'Gym',
                        },
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: holidayRoute,
                    value: {
                        waypoints: {
                            1: 'Home',
                            2: 'Beach',
                            3: 'Restaurant',
                        },
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: ONYX_KEYS.COLLECTION.ROUTES,
                    value: {
                        [holidayRoute]: {
                            waypoints: {
                                0: 'Bed',
                            },
                        },
                        [routineRoute]: {
                            waypoints: {
                                0: 'Bed',
                            },
                        },
                    } as GenericCollection,
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: holidayRoute,
                    value: {
                        waypoints: {
                            4: 'Home',
                        },
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: routineRoute,
                    value: {
                        waypoints: {
                            3: 'Gym',
                        },
                    },
                },
            ]).then(() => {
                expect(routesCollectionCallback).toHaveBeenNthCalledWith(
                    1,
                    {
                        [holidayRoute]: {
                            waypoints: {
                                0: 'Bed',
                                1: 'Home',
                                2: 'Beach',
                                3: 'Restaurant',
                                4: 'Home',
                            },
                        },
                        [routineRoute]: {
                            waypoints: {
                                0: 'Bed',
                                1: 'Home',
                                2: 'Work',
                                3: 'Gym',
                            },
                        },
                    },
                    ONYX_KEYS.COLLECTION.ROUTES,
                    {
                        [holidayRoute]: {waypoints: {0: 'Bed', 1: 'Home', 2: 'Beach', 3: 'Restaurant', 4: 'Home'}},
                        [routineRoute]: {waypoints: {0: 'Bed', 1: 'Home', 2: 'Work', 3: 'Gym'}},
                    },
                );

                connections.map((id) => Onyx.disconnect(id));
            });
        });

        it('should return a promise that completes when all update() operations are done', () => {
            const connections: Connection[] = [];

            const bob = `${ONYX_KEYS.COLLECTION.PEOPLE}bob`;
            const lisa = `${ONYX_KEYS.COLLECTION.PEOPLE}lisa`;

            const cat = `${ONYX_KEYS.COLLECTION.ANIMALS}cat`;
            const dog = `${ONYX_KEYS.COLLECTION.ANIMALS}dog`;

            const testCallback = jest.fn();
            const otherTestCallback = jest.fn();
            const peopleCollectionCallback = jest.fn();
            const animalsCollectionCallback = jest.fn();
            const catCallback = jest.fn();

            connections.push(Onyx.connect({key: ONYX_KEYS.TEST_KEY, callback: testCallback}));
            connections.push(Onyx.connect({key: ONYX_KEYS.OTHER_TEST, callback: otherTestCallback}));
            connections.push(
                Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.ANIMALS,
                    callback: animalsCollectionCallback,
                    waitForCollectionCallback: true,
                }),
            );
            connections.push(
                Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.PEOPLE,
                    callback: peopleCollectionCallback,
                    waitForCollectionCallback: true,
                }),
            );
            connections.push(Onyx.connect({key: cat, callback: catCallback}));

            return Onyx.update([
                {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.TEST_KEY, value: 'none'},
                {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.TEST_KEY, value: {food: 'taco'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.TEST_KEY, value: {drink: 'wine'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.OTHER_TEST, value: {food: 'pizza'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.OTHER_TEST, value: {drink: 'water'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: dog, value: {sound: 'woof'}},
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: ONYX_KEYS.COLLECTION.ANIMALS,
                    value: {
                        [cat]: {age: 5, size: 'S'},
                        [dog]: {size: 'M'},
                    } as GenericCollection,
                },
                {onyxMethod: Onyx.METHOD.SET, key: cat, value: {age: 3}},
                {onyxMethod: Onyx.METHOD.MERGE, key: cat, value: {sound: 'meow'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: bob, value: {car: 'sedan'}},
                {onyxMethod: Onyx.METHOD.MERGE, key: lisa, value: {car: 'SUV', age: 21}},
                {onyxMethod: Onyx.METHOD.MERGE, key: bob, value: {age: 25}},
            ]).then(() => {
                expect(testCallback).toHaveBeenNthCalledWith(1, {food: 'taco', drink: 'wine'}, ONYX_KEYS.TEST_KEY);

                expect(otherTestCallback).toHaveBeenNthCalledWith(1, {food: 'pizza', drink: 'water'}, ONYX_KEYS.OTHER_TEST);

                expect(animalsCollectionCallback).toHaveBeenNthCalledWith(
                    1,
                    {
                        [cat]: {age: 3, sound: 'meow'},
                    },
                    ONYX_KEYS.COLLECTION.ANIMALS,
                    {[cat]: {age: 3, sound: 'meow'}},
                );
                expect(animalsCollectionCallback).toHaveBeenNthCalledWith(
                    2,
                    {
                        [cat]: {age: 3, sound: 'meow'},
                        [dog]: {size: 'M', sound: 'woof'},
                    },
                    ONYX_KEYS.COLLECTION.ANIMALS,
                    {[dog]: {size: 'M', sound: 'woof'}},
                );

                expect(catCallback).toHaveBeenNthCalledWith(1, {age: 3, sound: 'meow'}, cat);

                expect(peopleCollectionCallback).toHaveBeenNthCalledWith(
                    1,
                    {
                        [bob]: {age: 25, car: 'sedan'},
                        [lisa]: {age: 21, car: 'SUV'},
                    },
                    ONYX_KEYS.COLLECTION.PEOPLE,
                    {[bob]: {age: 25, car: 'sedan'}, [lisa]: {age: 21, car: 'SUV'}},
                );

                connections.map((id) => Onyx.disconnect(id));
            });
        });

        it('should apply updates in the correct order with Onyx.update', () => {
            let testKeyValue: unknown;

            connection = Onyx.connect({
                key: ONYX_KEYS.TEST_KEY,
                initWithStoredValues: false,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            return Onyx.set(ONYX_KEYS.TEST_KEY, {})
                .then(() => {
                    expect(testKeyValue).toEqual({});
                    Onyx.update([
                        {
                            onyxMethod: 'merge',
                            key: ONYX_KEYS.TEST_KEY,
                            value: {test1: 'test1'},
                        },
                        {
                            onyxMethod: 'set',
                            key: ONYX_KEYS.TEST_KEY,
                            value: null,
                        },
                    ]);
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    expect(testKeyValue).toBeUndefined();
                });
        });

        it('should replace the old value after a null merge in the top-level object when batching updates', async () => {
            let result: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_UPDATE,
                waitForCollectionCallback: true,
                callback: (value) => {
                    result = value;
                },
            });

            await Onyx.multiSet({
                [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: {
                    id: 'entry1',
                    someKey: 'someValue',
                },
            });

            const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [
                {
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    // Removing the entire object in this update.
                    // Any subsequent changes to this key should completely replace the old value.
                    value: null,
                },
                {
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    // This change should completely replace `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1` old value.
                    value: {
                        someKey: 'someValueChanged',
                    },
                },
            ];

            await Onyx.update(queuedUpdates);

            expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: {someKey: 'someValueChanged'}});
            expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual({someKey: 'someValueChanged'});
        });

        describe('should replace the old value after a null merge in a nested property when batching updates', () => {
            let result: unknown;

            beforeEach(() => {
                connection = Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.TEST_UPDATE,
                    waitForCollectionCallback: true,
                    callback: (value) => {
                        result = value;
                    },
                });
            });

            it('replacing old object after null merge', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);
                const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        // Removing the "sub_entry1" object in this update.
                        // Any subsequent changes to this object should completely replace the existing object in store.
                        sub_entry1: null,
                    },
                });
                delete entry1ExpectedResult.sub_entry1;

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        // This change should completely replace "sub_entry1" existing object in store.
                        sub_entry1: {
                            newKey: 'newValue',
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1 = {newKey: 'newValue'};

                await Onyx.update(queuedUpdates);

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            it('setting new object after null merge', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                        someNestedObject: {
                            someNestedKey: 'someNestedValue',
                            anotherNestedObject: {
                                anotherNestedKey: 'anotherNestedValue',
                            },
                        },
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);
                const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        sub_entry1: {
                            someNestedObject: {
                                // Introducing a new "anotherNestedObject2" object in this update.
                                anotherNestedObject2: {
                                    anotherNestedKey2: 'anotherNestedValue2',
                                },
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2 = {anotherNestedKey2: 'anotherNestedValue2'};

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        sub_entry1: {
                            someNestedObject: {
                                // Removing the "anotherNestedObject2" object in this update.
                                // This property was only introduced in a previous update, so we don't need to care
                                // about an old existing value because there isn't one.
                                anotherNestedObject2: null,
                            },
                        },
                    },
                });
                delete entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2;

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        sub_entry1: {
                            someNestedObject: {
                                // Introducing the "anotherNestedObject2" object again with this update.
                                anotherNestedObject2: {
                                    newNestedKey2: 'newNestedValue2',
                                },
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2 = {newNestedKey2: 'newNestedValue2'};

                await Onyx.update(queuedUpdates);

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            it('setting new object after null merge of a primitive property', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                        someNestedObject: {
                            someNestedKey: 'someNestedValue',
                            anotherNestedObject: {
                                anotherNestedKey: 'anotherNestedValue',
                            },
                        },
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);
                const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        sub_entry1: {
                            someNestedObject: {
                                anotherNestedObject: {
                                    // Removing the "anotherNestedKey" property in this update.
                                    // This property's existing value in store is a primitive value, so we don't need to care
                                    // about it when merging new values in any next updates.
                                    anotherNestedKey: null,
                                },
                            },
                        },
                    },
                });
                delete entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject.anotherNestedKey;

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        sub_entry1: {
                            someNestedObject: {
                                anotherNestedObject: {
                                    // Setting a new object to the "anotherNestedKey" property.
                                    anotherNestedKey: {
                                        newNestedKey: 'newNestedValue',
                                    },
                                },
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject.anotherNestedKey = {newNestedKey: 'newNestedValue'};

                await Onyx.update(queuedUpdates);

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            it('replacing nested object during updates', async () => {
                const entry1: GenericDeepRecord | undefined = {
                    id: 'entry1',
                    someKey: 'someValue',
                };
                await Onyx.multiSet({
                    [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: {
                        id: 'entry1',
                        someKey: 'someValue',
                    },
                });

                let entry1ExpectedResult = lodashCloneDeep(entry1) as GenericDeepRecord | undefined;
                const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    // Removing the entire object in this update.
                    // Any subsequent changes to this key should completely replace the old value.
                    value: null,
                });
                entry1ExpectedResult = undefined;

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    // This change should completely replace `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1` old value.
                    value: {
                        someKey: 'someValueChanged',
                        someNestedObject: {
                            someNestedKey: 'someNestedValue',
                        },
                    },
                });
                entry1ExpectedResult = {someKey: 'someValueChanged', someNestedObject: {someNestedKey: 'someNestedValue'}};

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    value: {
                        // Removing the "sub_entry1" object in this update.
                        // Any subsequent changes to this key should completely replace the old update's value.
                        someNestedObject: null,
                    },
                });
                delete entry1ExpectedResult.someNestedObject;

                queuedUpdates.push({
                    key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                    onyxMethod: 'merge',
                    // This change should completely replace `someNestedObject` old update's value.
                    value: {
                        someNestedObject: {
                            someNestedKeyChanged: 'someNestedValueChange',
                        },
                    },
                });
                entry1ExpectedResult.someNestedObject = {someNestedKeyChanged: 'someNestedValueChange'};

                await Onyx.update(queuedUpdates);

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            describe('mergeCollection', () => {
                it('replacing old object after null merge', async () => {
                    const entry1: GenericDeepRecord = {
                        sub_entry1: {
                            id: 'sub_entry1',
                            someKey: 'someValue',
                        },
                    };

                    const entry2: GenericDeepRecord = {
                        sub_entry2: {
                            id: 'sub_entry2',
                            someKey: 'someValue',
                        },
                    };
                    await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});
                    await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`]: entry2});

                    const entry1ExpectedResult = lodashCloneDeep(entry1);
                    const entry2ExpectedResult = lodashCloneDeep(entry2);
                    const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

                    queuedUpdates.push(
                        {
                            key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                            onyxMethod: 'merge',
                            value: {
                                // Removing the "sub_entry1" object in this update.
                                // Any subsequent changes to this object should completely replace the existing object in store.
                                sub_entry1: null,
                            },
                        },
                        {
                            key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`,
                            onyxMethod: 'merge',
                            value: {
                                // Removing the "sub_entry2" object in this update.
                                // Any subsequent changes to this object should completely replace the existing object in store.
                                sub_entry2: null,
                            },
                        },
                    );
                    delete entry1ExpectedResult.sub_entry1;
                    delete entry2ExpectedResult.sub_entry2;

                    queuedUpdates.push(
                        {
                            key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`,
                            onyxMethod: 'merge',
                            value: {
                                // This change should completely replace "sub_entry1" existing object in store.
                                sub_entry1: {
                                    newKey: 'newValue',
                                },
                            },
                        },
                        {
                            key: `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`,
                            onyxMethod: 'merge',
                            value: {
                                // This change should completely replace "sub_entry2" existing object in store.
                                sub_entry2: {
                                    newKey: 'newValue',
                                },
                            },
                        },
                    );
                    entry1ExpectedResult.sub_entry1 = {newKey: 'newValue'};
                    entry2ExpectedResult.sub_entry2 = {newKey: 'newValue'};

                    await Onyx.update(queuedUpdates);

                    expect(result).toEqual({
                        [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult,
                        [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`]: entry2ExpectedResult,
                    });
                    expect(await StorageMock.multiGet([`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`])).toEqual([
                        [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, entry1ExpectedResult],
                        [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry2`, entry2ExpectedResult],
                    ]);
                });

                it('should not save a RAM-only collection to storage', async () => {
                    const key1 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
                    const key2 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`;

                    await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, {
                        [key1]: 'value 1',
                        [key2]: 'value 2',
                    });

                    await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, {
                        [key1]: 'updated value 1',
                        [key2]: 'updated value 2',
                    });

                    expect(await cache.get(key1)).toEqual('updated value 1');
                    expect(await cache.get(key2)).toEqual('updated value 2');
                    expect(await StorageMock.getItem(key1)).toBeNull();
                    expect(await StorageMock.getItem(key2)).toBeNull();
                });
            });
        });

        it('should properly handle setCollection operations in update()', () => {
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYX_KEYS.COLLECTION.ROUTES}B`;
            const routeC = `${ONYX_KEYS.COLLECTION.ROUTES}C`;

            let routesCollection: unknown;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => {
                    routesCollection = value;
                },
                waitForCollectionCallback: true,
            });

            return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB]: {name: 'Route B'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection)
                .then(() =>
                    Onyx.update([
                        {
                            onyxMethod: Onyx.METHOD.SET_COLLECTION,
                            key: ONYX_KEYS.COLLECTION.ROUTES,
                            value: {
                                [routeA]: {name: 'New Route A'},
                                [routeB]: {name: 'New Route B'},
                            } as GenericCollection,
                        },
                    ]),
                )
                .then(() => {
                    expect(routesCollection).toEqual({
                        [routeA]: {name: 'New Route A'},
                        [routeB]: {name: 'New Route B'},
                    });
                });
        });

        it('should handle mixed operations with setCollection in update()', () => {
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYX_KEYS.COLLECTION.ROUTES}B`;
            const testKey = ONYX_KEYS.TEST_KEY;
            let routesCollection: unknown;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => {
                    routesCollection = value;
                },
                waitForCollectionCallback: true,
            });

            let testKeyValue: unknown;
            Onyx.connect({
                key: testKey,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB]: {name: 'Route B'},
            } as GenericCollection)
                .then(() =>
                    Onyx.update([
                        {
                            onyxMethod: Onyx.METHOD.SET,
                            key: testKey,
                            value: 'test value',
                        },
                        {
                            onyxMethod: Onyx.METHOD.SET_COLLECTION,
                            key: ONYX_KEYS.COLLECTION.ROUTES,
                            value: {
                                [routeA]: {name: 'Final Route A'},
                            } as GenericCollection,
                        },
                        {
                            onyxMethod: Onyx.METHOD.MERGE,
                            key: testKey,
                            value: 'merged value',
                        },
                    ]),
                )
                .then(() => {
                    expect(routesCollection).toEqual({
                        [routeA]: {name: 'Final Route A'},
                    });

                    expect(testKeyValue).toBe('merged value');
                });
        });

        it('should trigger individual callbacks for each key when update is called with mergeCollection', async () => {
            const collectionCallback = jest.fn();
            const individualCallback1 = jest.fn();
            const individualCallback2 = jest.fn();
            const key1 = `${ONYX_KEYS.COLLECTION.TEST_KEY}1`;
            const key2 = `${ONYX_KEYS.COLLECTION.TEST_KEY}2`;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });

            const connection1 = Onyx.connect({
                key: key1,
                callback: individualCallback1,
            });

            const connection2 = Onyx.connect({
                key: key2,
                callback: individualCallback2,
            });

            await waitForPromisesToResolve();
            collectionCallback.mockClear();
            individualCallback1.mockClear();
            individualCallback2.mockClear();

            // Perform update with mergeCollection
            await Onyx.update([
                {
                    onyxMethod: 'mergecollection',
                    key: ONYX_KEYS.COLLECTION.TEST_KEY,
                    value: {
                        [key1]: {id: '1', name: 'Updated Item 1'},
                        [key2]: {id: '2', name: 'Updated Item 2'},
                    } as GenericCollection,
                },
            ]);

            // Collection callback should be called
            expect(collectionCallback).toHaveBeenCalled();

            // Individual callbacks should still work
            expect(individualCallback1).toHaveBeenCalledWith({id: '1', name: 'Updated Item 1'}, key1);
            expect(individualCallback2).toHaveBeenCalledWith({id: '2', name: 'Updated Item 2'}, key2);

            Onyx.disconnect(connection1);
            Onyx.disconnect(connection2);
        });

        it('should not save a RAM-only collection to storage', async () => {
            const queuedUpdates: Array<OnyxUpdate<OnyxKey>> = [];

            queuedUpdates.push(
                {
                    key: `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`,
                    onyxMethod: 'merge',
                    value: null,
                },
                {
                    key: `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`,
                    onyxMethod: 'merge',
                    value: null,
                },
            );

            queuedUpdates.push(
                {
                    key: `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`,
                    onyxMethod: 'merge',
                    value: 'updated test 1',
                },
                {
                    key: `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`,
                    onyxMethod: 'merge',
                    value: 'updated test 2',
                },
            );

            await Onyx.update(queuedUpdates);

            expect(cache.get(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`)).toEqual('updated test 1');
            expect(cache.get(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`)).toEqual('updated test 2');
            expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`)).toBeNull();
            expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`)).toBeNull();
        });

        describe('should log and skip invalid operations', () => {
            it('invalid method', async () => {
                await act(async () =>
                    Onyx.update([
                        {onyxMethod: 'set', key: ONYX_KEYS.TEST_KEY, value: 'test1'},
                        // @ts-expect-error invalid method
                        {onyxMethod: 'invalidMethod', key: ONYX_KEYS.OTHER_TEST, value: 'test2'},
                    ]),
                );

                expect(logInfoFn).toHaveBeenNthCalledWith(1, 'Invalid onyxMethod invalidMethod in Onyx update. Skipping this operation.');
            });

            it('non-object value passed to multiSet', async () => {
                await act(async () =>
                    Onyx.update([
                        // @ts-expect-error non-object value
                        {onyxMethod: 'multiset', key: ONYX_KEYS.TEST_KEY, value: []},
                    ]),
                );

                expect(logInfoFn).toHaveBeenNthCalledWith(1, 'Invalid value provided in Onyx multiSet. Value must be of type object. Skipping this operation.');
            });

            it('non-string value passed to key', async () => {
                await act(async () =>
                    Onyx.update([
                        // @ts-expect-error invalid key
                        {onyxMethod: 'set', key: 1000, value: 'test'},
                    ]),
                );

                expect(logInfoFn).toHaveBeenNthCalledWith(1, 'Invalid number key provided in Onyx update. Key must be of type string. Skipping this operation.');
            });

            it('invalid or empty value passed to mergeCollection', async () => {
                await act(async () =>
                    Onyx.update([
                        // @ts-expect-error invalid value
                        {onyxMethod: 'mergecollection', key: ONYX_KEYS.COLLECTION.TEST_KEY, value: 'test1'},
                    ]),
                );

                expect(logInfoFn).toHaveBeenNthCalledWith(1, 'Invalid or empty value provided in Onyx mergeCollection. Skipping this operation.');
            });
        });
    });

    describe('merge', () => {
        it('should replace the old value after a null merge in the top-level object when batching merges', async () => {
            let result: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_UPDATE,
                waitForCollectionCallback: true,
                callback: (value) => {
                    result = value;
                },
            });

            await Onyx.multiSet({
                [`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: {
                    id: 'entry1',
                    someKey: 'someValue',
                },
            });

            // Removing the entire object in this merge.
            // Any subsequent changes to this key should completely replace the old value.
            Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, null);

            // This change should completely replace `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1` old value.
            Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                someKey: 'someValueChanged',
            });

            await waitForPromisesToResolve();

            expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: {someKey: 'someValueChanged'}});
            expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual({someKey: 'someValueChanged'});
        });

        describe('should replace the old value after a null merge in a nested property when batching merges', () => {
            let result: unknown;

            beforeEach(() => {
                connection = Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.TEST_UPDATE,
                    waitForCollectionCallback: true,
                    callback: (value) => {
                        result = value;
                    },
                });
            });

            it('replacing old object after null merge', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    // Removing the "sub_entry1" object in this merge.
                    // Any subsequent changes to this object should completely replace the existing object in store.
                    sub_entry1: null,
                });
                delete entry1ExpectedResult.sub_entry1;

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    // This change should completely replace "sub_entry1" existing object in store.
                    sub_entry1: {
                        newKey: 'newValue',
                    },
                });
                entry1ExpectedResult.sub_entry1 = {newKey: 'newValue'};

                await waitForPromisesToResolve();

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            it('setting new object after null merge', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                        someNestedObject: {
                            someNestedKey: 'someNestedValue',
                            anotherNestedObject: {
                                anotherNestedKey: 'anotherNestedValue',
                            },
                        },
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    sub_entry1: {
                        someNestedObject: {
                            // Introducing a new "anotherNestedObject2" object in this merge.
                            anotherNestedObject2: {
                                anotherNestedKey2: 'anotherNestedValue2',
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2 = {anotherNestedKey2: 'anotherNestedValue2'};

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    sub_entry1: {
                        someNestedObject: {
                            // Removing the "anotherNestedObject2" object in this merge.
                            // This property was only introduced in a previous merge, so we don't need to care
                            // about an old existing value because there isn't one.
                            anotherNestedObject2: null,
                        },
                    },
                });
                delete entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2;

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    sub_entry1: {
                        someNestedObject: {
                            // Introducing the "anotherNestedObject2" object again with this update.
                            anotherNestedObject2: {
                                newNestedKey2: 'newNestedValue2',
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject2 = {newNestedKey2: 'newNestedValue2'};

                await waitForPromisesToResolve();

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });

            it('setting new object after null merge of a primitive property', async () => {
                const entry1: GenericDeepRecord = {
                    sub_entry1: {
                        id: 'sub_entry1',
                        someKey: 'someValue',
                        someNestedObject: {
                            someNestedKey: 'someNestedValue',
                            anotherNestedObject: {
                                anotherNestedKey: 'anotherNestedValue',
                            },
                        },
                    },
                };
                await Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1});

                const entry1ExpectedResult = lodashCloneDeep(entry1);

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    sub_entry1: {
                        someNestedObject: {
                            anotherNestedObject: {
                                // Removing the "anotherNestedKey" property in this merge.
                                // This property's existing value in store is a primitive value, so we don't need to care
                                // about it when merging new values in any next merges.
                                anotherNestedKey: null,
                            },
                        },
                    },
                });
                delete entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject.anotherNestedKey;

                Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`, {
                    sub_entry1: {
                        someNestedObject: {
                            anotherNestedObject: {
                                // Setting a new object to the "anotherNestedKey" property.
                                anotherNestedKey: {
                                    newNestedKey: 'newNestedValue',
                                },
                            },
                        },
                    },
                });
                entry1ExpectedResult.sub_entry1.someNestedObject.anotherNestedObject.anotherNestedKey = {newNestedKey: 'newNestedValue'};

                await waitForPromisesToResolve();

                expect(result).toEqual({[`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`]: entry1ExpectedResult});
                expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1`)).toEqual(entry1ExpectedResult);
            });
        });

        it('should remove a deeply nested null when merging an existing key', () => {
            let result: unknown;

            connection = Onyx.connect({
                key: ONYX_KEYS.TEST_KEY,
                initWithStoredValues: false,
                callback: (value) => (result = value),
            });

            const initialValue = {
                waypoints: {
                    1: 'Home',
                    2: 'Work',
                    3: 'Gym',
                },
            };

            return Onyx.set(ONYX_KEYS.TEST_KEY, initialValue)
                .then(() => {
                    expect(result).toEqual(initialValue);
                    Onyx.merge(ONYX_KEYS.TEST_KEY, {
                        waypoints: {
                            1: 'Home',
                            2: 'Work',
                            3: null,
                        },
                    });
                    return waitForPromisesToResolve();
                })
                .then(() => {
                    expect(result).toEqual({
                        waypoints: {
                            1: 'Home',
                            2: 'Work',
                        },
                    });
                });
        });

        it('should not save a RAM-only key to storage when using merge', async () => {
            await Onyx.merge(ONYX_KEYS.RAM_ONLY_TEST_KEY, {someProperty: 'value'});

            expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual({someProperty: 'value'});
            expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeNull();
        });

        it('should not save a RAM-only collection member to storage when using merge', async () => {
            const collectionMemberKey = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
            await Onyx.merge(collectionMemberKey, {data: 'test'});

            expect(cache.get(collectionMemberKey)).toEqual({data: 'test'});
            expect(await StorageMock.getItem(collectionMemberKey)).toBeNull();
        });
    });

    describe('set', () => {
        it('should work with skipCacheCheck option', () => {
            let testKeyValue: unknown;

            connection = Onyx.connect({
                key: ONYX_KEYS.TEST_KEY,
                initWithStoredValues: false,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            const testData = {id: 1, name: 'test'};

            return Onyx.set(ONYX_KEYS.TEST_KEY, testData)
                .then(() => {
                    expect(testKeyValue).toEqual(testData);

                    return Onyx.set(ONYX_KEYS.TEST_KEY, testData, {skipCacheCheck: true});
                })
                .then(() => {
                    expect(testKeyValue).toEqual(testData);
                });
        });

        it('should not save a RAM-only key to storage', async () => {
            await Onyx.set(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'test');

            expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual('test');
            expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeNull();
        });

        it('should not save a member of a RAM-only collection to storage', async () => {
            const collectionMemberKey = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
            await Onyx.set(collectionMemberKey, 'test');

            expect(cache.get(collectionMemberKey)).toEqual('test');
            expect(await StorageMock.getItem(collectionMemberKey)).toBeNull();
        });
    });

    describe('multiSet', () => {
        it('should only save non RAM-only keys to storage', async () => {
            const otherTestValue = 'non ram only value';
            const collectionMemberKey = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`;

            await Onyx.multiSet({
                [ONYX_KEYS.OTHER_TEST]: otherTestValue,
                [ONYX_KEYS.RAM_ONLY_TEST_KEY]: 'test value 1',
                [collectionMemberKey]: 'test value 2',
            });

            expect(await StorageMock.getItem(ONYX_KEYS.OTHER_TEST)).toEqual(otherTestValue);
            expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual('test value 1');
            expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeNull();
            expect(cache.get(collectionMemberKey)).toEqual('test value 2');
            expect(await StorageMock.getItem(collectionMemberKey)).toBeNull();
        });
    });

    describe('setCollection', () => {
        it('should replace all existing collection members with new values and remove old ones', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYX_KEYS.COLLECTION.ROUTES}B`;
            const routeB1 = `${ONYX_KEYS.COLLECTION.ROUTES}B1`;
            const routeC = `${ONYX_KEYS.COLLECTION.ROUTES}C`;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            // Set initial collection state
            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB1]: {name: 'Route B1'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection);

            // Replace with new collection data
            await Onyx.setCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'New Route A'},
                [routeB]: {name: 'New Route B'},
                [routeC]: {name: 'New Route C'},
            } as GenericCollection);

            expect(result).toEqual({
                [routeA]: {name: 'New Route A'},
                [routeB]: {name: 'New Route B'},
                [routeC]: {name: 'New Route C'},
            });
        });

        it('should replace the collection with empty values', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
            } as GenericCollection);

            await Onyx.setCollection(ONYX_KEYS.COLLECTION.ROUTES, {} as GenericCollection);

            expect(result).toEqual({});
        });

        it('should reject collection items with invalid keys', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;
            const invalidRoute = 'invalid_route';

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
            } as GenericCollection);

            await Onyx.setCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [invalidRoute]: {name: 'Invalid Route'},
            });

            expect(result).toEqual({
                [routeA]: {name: 'Route A'},
            });
        });

        it('should only trigger collection callback once when setCollection is called with null values', async () => {
            const mockCallback = jest.fn();
            const routeA = `${ONYX_KEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYX_KEYS.COLLECTION.ROUTES}B`;
            const routeC = `${ONYX_KEYS.COLLECTION.ROUTES}C`;

            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.ROUTES,
                waitForCollectionCallback: true,
                callback: mockCallback,
            });

            await waitForPromisesToResolve();
            expect(mockCallback).toHaveBeenCalledTimes(1);
            mockCallback.mockClear();

            // Call setCollection with mixed null and data values
            await Onyx.setCollection(ONYX_KEYS.COLLECTION.ROUTES, {
                [routeA]: null,
                [routeB]: {name: 'Route B'},
                [routeC]: null,
            } as GenericCollection);

            // Should only be called once
            expect(mockCallback).toHaveBeenCalledTimes(1);

            // Should receive filtered collection (only non-null values)
            const receivedData = mockCallback.mock.calls[0][0];
            expect(receivedData).toEqual({
                [routeB]: {name: 'Route B'},
            });
        });

        it('should not save a RAM-only collection to storage', async () => {
            const key1 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
            const key2 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`;

            await Onyx.setCollection(ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, {
                [key1]: 'test1',
                [key2]: 'test2',
            });

            expect(cache.get(key1)).toEqual('test1');
            expect(cache.get(key2)).toEqual('test2');
            expect(await StorageMock.getItem(key1)).toBeNull();
            expect(await StorageMock.getItem(key2)).toBeNull();
        });
    });

    describe('skippable collection member ids', () => {
        it('should skip the collection member id value when using Onyx.set()', async () => {
            let testKeyValue: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                initWithStoredValues: false,
                waitForCollectionCallback: true,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            await Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`, {id: 'entry1_id', name: 'entry2_name'});
            await Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`, {id: 'skippable-id_id', name: 'skippable-id_name'});

            expect(testKeyValue).toEqual({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry2_name'},
            });
        });

        it('should skip the collection member id value when using Onyx.merge()', async () => {
            let testKeyValue: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                initWithStoredValues: false,
                waitForCollectionCallback: true,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            await Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`, {id: 'entry1_id', name: 'entry2_name'});
            await Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`, {id: 'skippable-id_id', name: 'skippable-id_name'});

            expect(testKeyValue).toEqual({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry2_name'},
            });
        });

        it('should skip the collection member id value when using Onyx.mergeCollection()', async () => {
            let testKeyValue: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                initWithStoredValues: false,
                waitForCollectionCallback: true,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            await Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`]: {id: 'skippable-id_id', name: 'skippable-id_name'},
            } as GenericCollection);

            expect(testKeyValue).toEqual({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
            });
        });

        it('should skip the collection member id value when using Onyx.setCollection()', async () => {
            let testKeyValue: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                initWithStoredValues: false,
                waitForCollectionCallback: true,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            await Onyx.setCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`]: {id: 'skippable-id_id', name: 'skippable-id_name'},
            } as GenericCollection);

            expect(testKeyValue).toEqual({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
            });
        });

        it('should skip the collection member id value when using Onyx.multiSet()', async () => {
            let testKeyValue: unknown;
            connection = Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                initWithStoredValues: false,
                waitForCollectionCallback: true,
                callback: (value) => {
                    testKeyValue = value;
                },
            });

            await Onyx.multiSet({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}skippable-id`]: {id: 'skippable-id_id', name: 'skippable-id_name'},
            } as GenericCollection);

            expect(testKeyValue).toEqual({
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: {id: 'entry1_id', name: 'entry1_name'},
                [`${ONYX_KEYS.COLLECTION.TEST_KEY}entry2`]: {id: 'entry2_id', name: 'entry2_name'},
            });
        });
        it('should clear pending merge for a key during multiSet()', async () => {
            const testKey = `${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`;

            // Mock the merge queue with the correct type
            const mockMergeQueue: Record<string, unknown[]> = {
                [testKey]: [{some: 'mergeData'}],
            };

            // Mock the utility functions
            jest.spyOn(OnyxUtils, 'hasPendingMergeForKey').mockImplementation((key) => key === testKey);
            jest.spyOn(OnyxUtils, 'getMergeQueue').mockImplementation(() => mockMergeQueue);

            await Onyx.multiSet({
                [testKey]: {id: 'entry1_id', name: 'entry1_name'},
            });

            expect(mockMergeQueue[testKey]).toBeUndefined();

            jest.restoreAllMocks();
        });
    });

    describe('clear', () => {
        it('should handle RAM-only keys with defaults correctly during clear', async () => {
            // Set a value for RAM-only key
            await Onyx.set(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'some value');
            await Onyx.set(ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE, 'some other value');

            await Onyx.clear();

            // Verify it's not in storage
            expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeNull();
            expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE)).toBeNull();
            // Verify cache state based on whether there's a default
            expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeUndefined();
            expect(cache.get(ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE)).toEqual('default');
        });
    });
});

// Separate describe block for Onyx.init to control initialization during each test.
describe('Onyx.init', () => {
    let cache: typeof OnyxCache;

    beforeEach(() => {
        // Resets the deferred init task before each test.
        Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
        cache = require('../../lib/OnyxCache').default;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        return Onyx.clear();
    });

    describe('should only execute Onyx methods after initialization', () => {
        it('set', async () => {
            Onyx.set(ONYX_KEYS.TEST_KEY, 'test');
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toEqual('test');
        });

        it('multiSet', async () => {
            Onyx.multiSet({[`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: 'test_1'});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toEqual('test_1');
        });

        it('merge', async () => {
            Onyx.merge(ONYX_KEYS.TEST_KEY, 'test');
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toEqual('test');
        });

        it('mergeCollection', async () => {
            Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {[`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: 'test_1'});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toEqual('test_1');
        });

        it('clear', async () => {
            // Spies on a function that is exclusively called during Onyx.clear().
            const spyClearNullishStorageKeys = jest.spyOn(cache, 'clearNullishStorageKeys');

            Onyx.clear();
            await act(async () => waitForPromisesToResolve());

            expect(spyClearNullishStorageKeys).not.toHaveBeenCalled();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(spyClearNullishStorageKeys).toHaveBeenCalled();
        });

        it('update', async () => {
            Onyx.update([{onyxMethod: 'set', key: ONYX_KEYS.TEST_KEY, value: 'test'}]);
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(ONYX_KEYS.TEST_KEY)).toEqual('test');
        });

        it('setCollection', async () => {
            Onyx.setCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {[`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`]: 'test_1'});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toBeUndefined();

            Onyx.init({keys: ONYX_KEYS});
            await act(async () => waitForPromisesToResolve());

            expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST_KEY}entry1`)).toEqual('test_1');
        });
    });
});

// Separate describe block to control Onyx.init() per-test so we can pre-seed storage before init.
describe('RAM-only keys should not read from storage', () => {
    let cache: typeof OnyxCache;

    beforeEach(() => {
        Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
        cache = require('../../lib/OnyxCache').default;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        return Onyx.clear();
    });

    it('should not return stale storage data for a RAM-only key via get', async () => {
        // Simulate stale data left in storage from before the key was RAM-only
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'stale_value');

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        let receivedValue: unknown;
        const connection = Onyx.connect({
            key: ONYX_KEYS.RAM_ONLY_TEST_KEY,
            callback: (value) => {
                receivedValue = value;
            },
        });
        await act(async () => waitForPromisesToResolve());

        expect(receivedValue).toBeUndefined();
        expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeUndefined();

        Onyx.disconnect(connection);
    });

    it('should not return stale storage data for RAM-only collection members via multiGet', async () => {
        const collectionMember1 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
        const collectionMember2 = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}2`;

        // Simulate stale collection members in storage
        await StorageMock.setItem(collectionMember1, {name: 'stale_1'});
        await StorageMock.setItem(collectionMember2, {name: 'stale_2'});

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        let receivedCollection: OnyxCollection<unknown>;
        const connection = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION,
            callback: (value) => {
                receivedCollection = value;
            },
            waitForCollectionCallback: true,
        });
        await act(async () => waitForPromisesToResolve());

        expect(receivedCollection!).toBeUndefined();
        expect(cache.get(collectionMember1)).toBeUndefined();
        expect(cache.get(collectionMember2)).toBeUndefined();

        Onyx.disconnect(connection);
    });

    it('should not include stale RAM-only keys in getAllKeys results', async () => {
        // Simulate stale data in storage
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'stale_value');
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`, {stale: 'member'});
        await StorageMock.setItem(ONYX_KEYS.OTHER_TEST, 'normal_value');

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        const keys = await OnyxUtils.getAllKeys();

        expect(keys.has(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBe(false);
        expect(keys.has(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`)).toBe(false);
        // Normal keys should still be present
        expect(keys.has(ONYX_KEYS.OTHER_TEST)).toBe(true);
    });

    it('should not read stale storage data for RAM-only keys during initializeWithDefaultKeyStates', async () => {
        // Simulate stale data for a RAM-only key that also has a default key state
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE, 'stale_value');

        Onyx.init({
            keys: ONYX_KEYS,
            initialKeyStates: {
                [ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE]: 'default_value',
            },
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        // The cache should have the default value, not the stale storage value
        expect(cache.get(ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE)).toEqual('default_value');
    });

    it('should not use stale storage data as merge base for RAM-only keys', async () => {
        // Simulate stale data in storage
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_TEST_KEY, {name: 'stale', token: 'old_token'});

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        // Merge new data — should NOT merge with stale storage value
        await Onyx.merge(ONYX_KEYS.RAM_ONLY_TEST_KEY, {name: 'new'});

        // The result should only contain the merged value, not the stale token
        expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual({name: 'new'});
    });

    it('should not read stale storage data when subscribing to individual RAM-only collection members', async () => {
        const collectionMember = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;

        // Simulate stale data in storage
        await StorageMock.setItem(collectionMember, {data: 'stale'});

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        const receivedValues: unknown[] = [];
        const connection = Onyx.connect({
            key: collectionMember,
            callback: (value) => {
                receivedValues.push(value);
            },
        });
        await act(async () => waitForPromisesToResolve());

        // Should never receive the stale value
        expect(receivedValues.every((v) => v === undefined || v === null)).toBe(true);

        Onyx.disconnect(connection);
    });

    it('should still work correctly for normal keys when RAM-only keys have stale storage data', async () => {
        // Simulate both normal and RAM-only stale data in storage
        await StorageMock.setItem(ONYX_KEYS.TEST_KEY, 'normal_value');
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'stale_ram_value');

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        let normalValue: unknown;
        let ramOnlyValue: unknown;

        const connection1 = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            callback: (value) => {
                normalValue = value;
            },
        });
        const connection2 = Onyx.connect({
            key: ONYX_KEYS.RAM_ONLY_TEST_KEY,
            callback: (value) => {
                ramOnlyValue = value;
            },
        });
        await act(async () => waitForPromisesToResolve());

        // Normal key should read from storage as expected
        expect(normalValue).toEqual('normal_value');
        // RAM-only key should NOT read stale value from storage
        expect(ramOnlyValue).toBeUndefined();

        Onyx.disconnect(connection1);
        Onyx.disconnect(connection2);
    });

    it('should not sync RAM-only keys from other instances via keepInstancesSync', async () => {
        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
            shouldSyncMultipleInstances: true,
        });
        await act(async () => waitForPromisesToResolve());

        // Get the callback that was passed to keepInstancesSync
        const syncCallback = (StorageMock.keepInstancesSync as jest.Mock).mock.calls[0]?.[0];
        expect(syncCallback).toBeDefined();

        let receivedValue: unknown;
        const connection = Onyx.connect({
            key: ONYX_KEYS.RAM_ONLY_TEST_KEY,
            callback: (value) => {
                receivedValue = value;
            },
        });
        await act(async () => waitForPromisesToResolve());

        // Simulate another tab syncing a stale RAM-only key value
        syncCallback(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'synced_stale_value');
        await act(async () => waitForPromisesToResolve());

        // The RAM-only key should NOT have been updated from the sync
        expect(receivedValue).toBeUndefined();
        expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeUndefined();

        // Verify that normal keys still sync correctly
        let normalValue: unknown;
        const connection2 = Onyx.connect({
            key: ONYX_KEYS.OTHER_TEST,
            callback: (value) => {
                normalValue = value;
            },
        });
        await act(async () => waitForPromisesToResolve());

        syncCallback(ONYX_KEYS.OTHER_TEST, 'synced_normal_value');
        await act(async () => waitForPromisesToResolve());

        expect(normalValue).toEqual('synced_normal_value');

        Onyx.disconnect(connection);
        Onyx.disconnect(connection2);
    });

    it('should serve RAM-only keys from cache and normal keys from storage in multiGet', async () => {
        const ramOnlyMember = `${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}1`;
        const normalMember = `${ONYX_KEYS.COLLECTION.TEST_KEY}1`;

        // Pre-seed storage with stale data for both normal and RAM-only keys
        await StorageMock.setItem(normalMember, 'normal_from_storage');
        await StorageMock.setItem(ramOnlyMember, {data: 'stale_collection_member'});

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        // Set a RAM-only collection member via Onyx (goes to cache only)
        await Onyx.set(ramOnlyMember, {data: 'fresh_from_cache'});

        // multiGet receives individual keys (e.g. collection members), not collection base keys
        const result = await OnyxUtils.multiGet([normalMember, ramOnlyMember]);

        // Normal key should come from storage
        expect(result.get(normalMember)).toEqual('normal_from_storage');
        // RAM-only collection member should come from cache, not stale storage
        expect(result.get(ramOnlyMember)).toEqual({data: 'fresh_from_cache'});
    });

    it('should return cached value for RAM-only key after set then connect', async () => {
        await StorageMock.setItem(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'stale_value');

        Onyx.init({
            keys: ONYX_KEYS,
            ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION, ONYX_KEYS.RAM_ONLY_WITH_INITIAL_VALUE],
        });
        await act(async () => waitForPromisesToResolve());

        // Write a fresh value to the RAM-only key
        await Onyx.set(ONYX_KEYS.RAM_ONLY_TEST_KEY, 'fresh_value');

        let receivedValue: unknown;
        const connection = Onyx.connect({
            key: ONYX_KEYS.RAM_ONLY_TEST_KEY,
            callback: (value) => {
                receivedValue = value;
            },
        });
        await act(async () => waitForPromisesToResolve());

        // Should get the fresh cached value, not the stale storage value
        expect(receivedValue).toEqual('fresh_value');
        expect(cache.get(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual('fresh_value');

        // Verify storage was NOT written to
        const storageValue = await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY);
        expect(storageValue).toEqual('stale_value');

        Onyx.disconnect(connection);
    });
});
