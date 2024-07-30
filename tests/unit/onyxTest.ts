import lodashClone from 'lodash/clone';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import OnyxUtils from '../../lib/OnyxUtils';
import type OnyxCache from '../../lib/OnyxCache';
import type {OnyxCollection, OnyxUpdate} from '../../lib/types';
import type GenericCollection from '../utils/GenericCollection';
import type {ConnectionMetadata} from '../../lib/OnyxConnectionManager';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_CONNECT_COLLECTION: 'testConnectCollection_',
        TEST_POLICY: 'testPolicy_',
        TEST_UPDATE: 'testUpdate_',
        PEOPLE: 'people_',
        ANIMALS: 'animals_',
        SNAPSHOT: 'snapshot_',
        ROUTES: 'routes_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    initialKeyStates: {
        [ONYX_KEYS.OTHER_TEST]: 42,
    },
});

describe('Onyx', () => {
    let connection: ConnectionMetadata | undefined;

    /** @type OnyxCache */
    let cache: typeof OnyxCache;

    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
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
            .then(() => {
                // Checks if cache value is removed.
                expect(cache.getAllKeys().size).toBe(0);

                // When cache keys length is 0, we fetch the keys from storage.
                return OnyxUtils.getAllKeys();
            })
            .then((keys) => {
                expect(keys.has(ONYX_KEYS.OTHER_TEST)).toBe(false);
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

        let otherTestValue: unknown;
        const otherTestConnection = Onyx.connect({
            key: ONYX_KEYS.OTHER_TEST,
            callback: (value) => {
                otherTestValue = value;
            },
        });

        return waitForPromisesToResolve()
            .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, 'test'))
            .then(() => {
                expect(testKeyValue).toBe('test');
                return Onyx.clear().then(waitForPromisesToResolve);
            })
            .then(() => {
                // Test key should be cleared
                expect(testKeyValue).toBeUndefined();

                // Other test key should be returned to its default state
                expect(otherTestValue).toBe(42);

                return Onyx.disconnect(otherTestConnection);
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
                        },
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

    it('should throw an error when the data object is incorrect in Onyx.update', () => {
        // Given the invalid data object with onyxMethod='multiSet'
        const data: unknown[] = [
            {onyxMethod: 'set', key: ONYX_KEYS.TEST_KEY, value: 'four'},
            {onyxMethod: 'murge', key: ONYX_KEYS.OTHER_TEST, value: {test2: 'test2'}},
        ];

        try {
            // When we pass it to Onyx.update
            // @ts-expect-error This is an invalid call to Onyx.update
            Onyx.update(data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error) {
            if (error instanceof Error) {
                // Then we should expect the error message below
                expect(error.message).toEqual('Invalid onyxMethod murge in Onyx update.');
            } else {
                throw error;
            }
        }

        try {
            // Given the invalid data object with key=true
            data[1] = {onyxMethod: 'merge', key: true, value: {test2: 'test2'}};

            // When we pass it to Onyx.update
            // @ts-expect-error This is an invalid call to Onyx.update
            Onyx.update(data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error) {
            if (error instanceof Error) {
                // Then we should expect the error message below
                expect(error.message).toEqual('Invalid boolean key provided in Onyx update. Onyx key must be of type string.');
            } else {
                throw error;
            }
        }
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
                ] as unknown as OnyxUpdate[]),
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

    it('should reject an improperly formatted multiset operation called via update', () => {
        try {
            Onyx.update([
                {
                    onyxMethod: 'multiset',
                    value: [
                        {
                            ID: 123,
                            value: 'one',
                        },
                        {
                            ID: 234,
                            value: 'two',
                        },
                    ],
                },
            ] as unknown as OnyxUpdate[]);
        } catch (error) {
            if (error instanceof Error) {
                expect(error.message).toEqual('Invalid value provided in Onyx multiSet. Onyx multiSet value must be of type object.');
            } else {
                throw error;
            }
        }
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
                expect(mockCallback).toHaveBeenCalledWith(initialCollectionData, undefined);
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
                    expect(mockCallback).toHaveBeenNthCalledWith(1, undefined, undefined);

                    // AND the value for the second call should be collectionUpdate since the collection was updated
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate, undefined);
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
                    expect(mockCallback).toHaveBeenLastCalledWith(collectionUpdate, undefined);
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
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate, undefined);
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
                    expect(mockCallback).toHaveBeenNthCalledWith(1, collectionUpdate, undefined);
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
        const connections: ConnectionMetadata[] = [];

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
                {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYX_KEYS.COLLECTION.TEST_UPDATE, value: {[itemKey]: {a: 'a'}}},
            ]).then(() => {
                expect(collectionCallback).toHaveBeenCalledTimes(2);
                expect(collectionCallback).toHaveBeenNthCalledWith(1, undefined, undefined);
                expect(collectionCallback).toHaveBeenNthCalledWith(2, {[itemKey]: {a: 'a'}}, undefined);

                expect(testCallback).toHaveBeenCalledTimes(2);
                expect(testCallback).toHaveBeenNthCalledWith(1, undefined, undefined);
                expect(testCallback).toHaveBeenNthCalledWith(2, 'taco', ONYX_KEYS.TEST_KEY);

                expect(otherTestCallback).toHaveBeenCalledTimes(2);
                // We set an initial value of 42 for ONYX_KEYS.OTHER_TEST in Onyx.init()
                expect(otherTestCallback).toHaveBeenNthCalledWith(1, 42, ONYX_KEYS.OTHER_TEST);
                expect(otherTestCallback).toHaveBeenNthCalledWith(2, 'pizza', ONYX_KEYS.OTHER_TEST);
                connections.forEach((id) => Onyx.disconnect(id));
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
                expect(testKeyValue).toEqual(undefined);
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
        const connections: ConnectionMetadata[] = [];

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
                expect(collectionCallback).toHaveBeenCalledWith(collectionDiff, undefined);

                expect(catCallback).toHaveBeenCalledTimes(2);
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

        await Onyx.update([{key: cat, value: finalValue, onyxMethod: Onyx.METHOD.MERGE}]);

        expect(callback).toBeCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(1, {data: {[cat]: initialValue}}, snapshot1);
        expect(callback).toHaveBeenNthCalledWith(2, {data: {[cat]: finalValue}}, snapshot1);
    });

    describe('update', () => {
        it('should squash all updates of collection-related keys into a single mergeCollection call', () => {
            const connections: ConnectionMetadata[] = [];

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
                    },
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
                    undefined,
                );

                connections.map((id) => Onyx.disconnect(id));
            });
        });

        it('should return a promise that completes when all update() operations are done', () => {
            const connections: ConnectionMetadata[] = [];

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
                    },
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
                    undefined,
                );
                expect(animalsCollectionCallback).toHaveBeenNthCalledWith(
                    2,
                    {
                        [cat]: {age: 3, sound: 'meow'},
                        [dog]: {size: 'M', sound: 'woof'},
                    },
                    undefined,
                );

                expect(catCallback).toHaveBeenNthCalledWith(1, {age: 3, sound: 'meow'}, cat);

                expect(peopleCollectionCallback).toHaveBeenNthCalledWith(
                    1,
                    {
                        [bob]: {age: 25, car: 'sedan'},
                        [lisa]: {age: 21, car: 'SUV'},
                    },
                    undefined,
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

        describe('merge', () => {
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
        });
    });
});
