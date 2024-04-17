import _ from 'underscore';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import OnyxUtils from '../../lib/OnyxUtils';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_CONNECT_COLLECTION: 'testConnectCollection_',
        TEST_POLICY: 'testPolicy_',
        TEST_UPDATE: 'testUpdate_',
    },
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
    initialKeyStates: {
        [ONYX_KEYS.OTHER_TEST]: 42,
    },
});

describe('Onyx', () => {
    let connectionID;

    /** @type OnyxCache */
    let cache;

    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;
    });

    afterEach(() => {
        Onyx.disconnect(connectionID);
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
        let testKeyValue;

        connectionID = Onyx.connect({
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
        let testKeyValue;

        connectionID = Onyx.connect({
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

    })

    it('should merge an object with another object', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
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
        let testKeyValue;

        connectionID = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.merge(ONYX_KEYS.TEST_KEY, ['test'])
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
                return Onyx.merge(ONYX_KEYS.TEST_KEY, { test2: 'test2' });
            })
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test']);
            });
    })

    it('should notify subscribers when data has been cleared', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        let otherTestValue;
        const otherTestConnectionID = Onyx.connect({
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
                expect(testKeyValue).toBeNull();

                // Other test key should be returned to its default state
                expect(otherTestValue).toBe(42);

                return Onyx.disconnect(otherTestConnectionID);
            });
    });

    it('should not notify subscribers after they have disconnected', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
                Onyx.disconnect(connectionID);
                return Onyx.set(ONYX_KEYS.TEST_KEY, 'test updated');
            })
            .then(() => {
                // Test value has not changed
                expect(testKeyValue).toBe('test');
            });
    });

    it('should merge arrays by replacing previous value with new value', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
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
        let testKeyValue;
        connectionID = Onyx.connect({
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
        let testKeyValue;
        connectionID = Onyx.connect({
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

    it('should ignore top-level undefined values', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        return Onyx.set(ONYX_KEYS.TEST_KEY, {test1: 'test1'})
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
                return Onyx.merge(ONYX_KEYS.TEST_KEY, undefined);
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1'});
            });
    });

    it('should remove keys that are set to null when merging', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
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

    it('should ignore `undefined` values when merging', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
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
            });
    });

    it('should overwrite an array key nested inside an object', () => {
        let testKeyValue;
        connectionID = Onyx.connect({
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
        let testKeyValue;
        connectionID = Onyx.connect({
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
        const valuesReceived = {};
        const mockCallback = jest.fn((data) => (valuesReceived[data.ID] = data.value));
        connectionID = Onyx.connect({
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
        })
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
                }),
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
        const valuesReceived = {};
        connectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (data, key) => (valuesReceived[key] = data),
        });

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, notMyTest: {beep: 'boop'}}).then(() => {
            expect(valuesReceived).toEqual({});
        });
    });

    it('should return full object to callback when calling mergeCollection()', () => {
        const valuesReceived = {};
        connectionID = Onyx.connect({
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
                }),
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
        let testKeyValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.TEST_KEY,
            initWithStoredValues: false,
            callback: (value) => {
                testKeyValue = value;
            },
        });

        let otherTestKeyValue;
        connectionID = Onyx.connect({
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
        const valuesReceived = {};
        const mockCallback = jest.fn((data) => (valuesReceived[data.ID] = data.value));
        connectionID = Onyx.connect({
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
        const data = [
            {onyxMethod: 'set', key: ONYX_KEYS.TEST_KEY, value: 'four'},
            {onyxMethod: 'murge', key: ONYX_KEYS.OTHER_TEST, value: {test2: 'test2'}},
        ];

        try {
            // When we pass it to Onyx.update
            Onyx.update(data);
        } catch (error) {
            // Then we should expect the error message below
            expect(error.message).toEqual('Invalid onyxMethod murge in Onyx update.');
        }

        try {
            // Given the invalid data object with key=true
            data[1] = {onyxMethod: 'merge', key: true, value: {test2: 'test2'}};

            // When we pass it to Onyx.update
            Onyx.update(data);
        } catch (error) {
            // Then we should expect the error message below
            expect(error.message).toEqual('Invalid boolean key provided in Onyx update. Onyx key must be of type string.');
        }
    });

    it('should properly set all keys provided in a multiSet called via update', () => {
        const valuesReceived = {};
        connectionID = Onyx.connect({
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
                ]),
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
            ]);
        } catch (error) {
            expect(error.message).toEqual('Invalid value provided in Onyx multiSet. Onyx multiSet value must be of type object.');
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

        return Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION, initialCollectionData)
            .then(() => {
                // When we connect to that collection with waitForCollectionCallback = true
                connectionID = Onyx.connect({
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
        connectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When mergeCollection is called with an updated collection
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // AND the value for the first call should be null since the collection was not initialized at that point
                    expect(mockCallback).toHaveBeenNthCalledWith(1, null, undefined);

                    // AND the value for the second call should be collectionUpdate since the collection was updated
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate);
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
        connectionID = Onyx.connect({
            key: `${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`,
            callback: mockCallback,
        });
        return (
            waitForPromisesToResolve()
                // When mergeCollection is called with an updated collection
                .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate))
                .then(() => {
                    // Then we expect the callback to have called twice, once for the initial connect call + once for the collection update
                    expect(mockCallback).toHaveBeenCalledTimes(2);

                    // AND the value for the first call should be null since the collection was not initialized at that point
                    expect(mockCallback).toHaveBeenNthCalledWith(1, null, undefined);

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
        connectionID = Onyx.connect({
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
                    expect(mockCallback).toHaveBeenLastCalledWith(collectionUpdate);
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
        connectionID = Onyx.connect({
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
                    expect(mockCallback).toHaveBeenNthCalledWith(2, collectionUpdate);
                })

                // When merge is called again with the same collection not modified
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we should not expect another invocation of the callback
                    expect(mockCallback).toHaveBeenCalledTimes(2);
                })

                // When merge is called again with an object of equivalent value but not the same reference
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, _.clone(collectionUpdate.testPolicy_1)))
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
        connectionID = Onyx.connect({
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
                    expect(mockCallback).toHaveBeenNthCalledWith(1, collectionUpdate);
                })

                // When merge is called again with the same collection not modified
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, collectionUpdate.testPolicy_1))
                .then(() => {
                    // Then we should expect another invocation of the callback because initWithStoredValues = false
                    expect(mockCallback).toHaveBeenCalledTimes(2);
                })

                // When merge is called again with an object of equivalent value but not the same reference
                .then(() => Onyx.merge(`${ONYX_KEYS.COLLECTION.TEST_POLICY}${1}`, _.clone(collectionUpdate.testPolicy_1)))
                .then(() => {
                    // Then we should expect another invocation of the callback because initWithStoredValues = false
                    expect(mockCallback).toHaveBeenCalledTimes(3);
                })
        );
    });

    it('should return a promise that completes when all update() operations are done', () => {
        const connectionIDs = [];

        const testCallback = jest.fn();
        const otherTestCallback = jest.fn();
        const collectionCallback = jest.fn();
        const itemKey = `${ONYX_KEYS.COLLECTION.TEST_UPDATE}1`;

        connectionIDs.push(Onyx.connect({key: ONYX_KEYS.TEST_KEY, callback: testCallback}));
        connectionIDs.push(Onyx.connect({key: ONYX_KEYS.OTHER_TEST, callback: otherTestCallback}));
        connectionIDs.push(Onyx.connect({key: ONYX_KEYS.COLLECTION.TEST_UPDATE, callback: collectionCallback, waitForCollectionCallback: true}));
        return Onyx.update([
            {onyxMethod: Onyx.METHOD.SET, key: ONYX_KEYS.TEST_KEY, value: 'taco'},
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYX_KEYS.OTHER_TEST, value: 'pizza'},
            {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYX_KEYS.COLLECTION.TEST_UPDATE, value: {[itemKey]: {a: 'a'}}},
        ]).then(() => {
            expect(collectionCallback).toHaveBeenNthCalledWith(1, {[itemKey]: {a: 'a'}});
            expect(testCallback).toHaveBeenNthCalledWith(1, 'taco', ONYX_KEYS.TEST_KEY);
            expect(otherTestCallback).toHaveBeenNthCalledWith(1, 'pizza', ONYX_KEYS.OTHER_TEST);
            Onyx.disconnect(connectionIDs);
        });
    });

    it('should merge an object with a batch of objects and undefined', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
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
        let testKeyValue;

        connectionID = Onyx.connect({
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
        let testKeyValue;

        connectionID = Onyx.connect({
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
                expect(testKeyValue).toEqual(null);
                return Onyx.merge(ONYX_KEYS.TEST_KEY, 2);
            })
            .then(() => {
                expect(testKeyValue).toEqual(2);
            });
    });

    it('should merge a non-existing key with a nested null removed', () => {
        let testKeyValue;

        connectionID = Onyx.connect({
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
        let testKeyValue;

        connectionID = Onyx.connect({
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
                expect(testKeyValue).toEqual(null);
            });
    });
});
