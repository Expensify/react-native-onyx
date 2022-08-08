import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_CONNECT_COLLECTION: 'test_connect_collection_',
        TEST_POLICY: 'test_policy_',
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

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

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
        return Onyx.set(ONYX_KEYS.TEST_KEY, 'test')
            .then(() => {
                expect(testKeyValue).toBe('test');
            });
    });

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
                Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toEqual({test1: 'test1', test2: 'test2'});
            });
    });

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
                expect(otherTestValue).toBe(42);
                return Onyx.clear().then(waitForPromisesToResolve);
            })
            .then(() => {
                expect(testKeyValue).toBeNull();
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

    it('should merge arrays by appending new items to the end of a value', () => {
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
                Onyx.merge(ONYX_KEYS.TEST_KEY, ['test2', 'test3', 'test4']);
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toStrictEqual(['test1', 'test2', 'test3', 'test4']);
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
        Onyx.merge(ONYX_KEYS.TEST_KEY, {test2: 'test2'});
        return waitForPromisesToResolve()
            .then(() => {
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
        Onyx.merge(ONYX_KEYS.TEST_KEY, ['test2']);
        return waitForPromisesToResolve()
            .then(() => {
                expect(testKeyValue).toEqual(['test1', 'test2']);
            });
    });

    it('should properly set and merge when using mergeCollection', () => {
        const valuesReceived = {};
        const mockCallback = jest.fn(data => valuesReceived[data.ID] = data.value);
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
            .then(() => (

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
                    test_4: {
                        ID: 456,
                        value: 'two',
                    },
                    test_5: {
                        ID: 567,
                        value: 'one',
                    },
                })
            ))
            .then(() => {
                // 3 items on the first mergeCollection + 4 items the next mergeCollection
                expect(mockCallback.mock.calls.length).toBe(7);

                expect(mockCallback.mock.calls[0][0]).toEqual({ID: 123, value: 'one'});
                expect(mockCallback.mock.calls[0][1]).toEqual('test_1');

                expect(mockCallback.mock.calls[1][0]).toEqual({ID: 234, value: 'two'});
                expect(mockCallback.mock.calls[1][1]).toEqual('test_2');

                expect(mockCallback.mock.calls[2][0]).toEqual({ID: 345, value: 'three'});
                expect(mockCallback.mock.calls[2][1]).toEqual('test_3');

                expect(mockCallback.mock.calls[3][0]).toEqual({ID: 123, value: 'five'});
                expect(mockCallback.mock.calls[3][1]).toEqual('test_1');

                expect(mockCallback.mock.calls[4][0]).toEqual({ID: 234, value: 'four'});
                expect(mockCallback.mock.calls[4][1]).toEqual('test_2');

                expect(mockCallback.mock.calls[5][0]).toEqual({ID: 456, value: 'two'});
                expect(mockCallback.mock.calls[5][1]).toEqual('test_4');

                expect(mockCallback.mock.calls[6][0]).toEqual({ID: 567, value: 'one'});
                expect(mockCallback.mock.calls[6][1]).toEqual('test_5');

                expect(valuesReceived[123]).toEqual('five');
                expect(valuesReceived[234]).toEqual('four');
                expect(valuesReceived[345]).toEqual('three');
                expect(valuesReceived[456]).toEqual('two');
                expect(valuesReceived[567]).toEqual('one');
            });
    });

    it('should throw error when a key not belonging to collection key is present in mergeCollection', () => {
        try {
            Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, notMyTest: {beep: 'boop'}});
        } catch (error) {
            expect(error.message).toEqual(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${ONYX_KEYS.COLLECTION.TEST_KEY}, DataKey: notMyTest`);
        }
    });

    it('should return full object to callback when calling mergeCollection()', () => {
        const valuesReceived = {};
        connectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: (data, key) => valuesReceived[key] = data,
        });

        return Onyx.multiSet({
            test_1: {
                existingData: 'test',
            },
            test_2: {
                existingData: 'test',
            },
        })
            .then(() => Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                test_1: {
                    ID: 123,
                    value: 'one',
                },
                test_2: {
                    ID: 234,
                    value: 'two',
                },
            }))
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
                // GIVEN the initial Onyx state: {test: true, otherTest: {test1: 'test1'}}
                Onyx.set(ONYX_KEYS.TEST_KEY, true);
                Onyx.set(ONYX_KEYS.OTHER_TEST, {test1: 'test1'});
                return waitForPromisesToResolve();
            })
            .then(() => {
                expect(testKeyValue).toBe(true);
                expect(otherTestKeyValue).toEqual({test1: 'test1'});

                // WHEN we pass a data object to Onyx.update
                Onyx.update([
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
                return waitForPromisesToResolve();
            })
            .then(() => {
                // THEN the final Onyx state should be {test: 'one', otherTest: {test1: 'test1', test2: 'test2'}}
                expect(testKeyValue).toBe('one');
                expect(otherTestKeyValue).toEqual({test1: 'test1', test2: 'test2'});
            });
    });

    it('should use update data object to merge a collection of keys', () => {
        const valuesReceived = {};
        const mockCallback = jest.fn(data => valuesReceived[data.ID] = data.value);
        connectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            initWithStoredValues: false,
            callback: mockCallback,
        });

        return waitForPromisesToResolve()
            .then(() => {
                // GIVEN the initial Onyx state: {test_1: {existingData: 'test',}, test_2: {existingData: 'test',}}
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
                expect(mockCallback.mock.calls[0][0]).toEqual({existingData: 'test'});
                expect(mockCallback.mock.calls[0][1]).toEqual('test_1');

                expect(mockCallback.mock.calls[1][0]).toEqual({existingData: 'test'});
                expect(mockCallback.mock.calls[1][1]).toEqual('test_2');

                // WHEN we pass a mergeCollection data object to Onyx.update
                Onyx.update([
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
                return waitForPromisesToResolve();
            })
            .then(() => {
                /* THEN the final Onyx state should be:
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

                expect(mockCallback.mock.calls[2][0]).toEqual({ID: 123, value: 'one', existingData: 'test'});
                expect(mockCallback.mock.calls[2][1]).toEqual('test_1');

                expect(mockCallback.mock.calls[3][0]).toEqual({ID: 234, value: 'two', existingData: 'test'});
                expect(mockCallback.mock.calls[3][1]).toEqual('test_2');

                expect(mockCallback.mock.calls[4][0]).toEqual({ID: 345, value: 'three'});
                expect(mockCallback.mock.calls[4][1]).toEqual('test_3');
            });
    });

    it('should throw an error when the data object is incorrect in Onyx.update', () => {
        // GIVEN the invalid data object with onyxMethod='multiSet'
        const data = [
            {onyxMethod: 'set', key: ONYX_KEYS.TEST_KEY, value: 'four'},
            {onyxMethod: 'multiSet', key: ONYX_KEYS.OTHER_TEST, value: {test2: 'test2'}},
        ];

        try {
            // WHEN we pass it to Onyx.update
            Onyx.update(data);
        } catch (error) {
            // THEN we should expect the error message below
            expect(error.message).toEqual('Invalid onyxMethod multiSet in Onyx update.');
        }

        try {
            // GIVEN the invalid data object with key=true
            data[1] = {onyxMethod: 'merge', key: true, value: {test2: 'test2'}};

            // WHEN we pass it to Onyx.update
            Onyx.update(data);
        } catch (error) {
            // THEN we should expect the error message below
            expect(error.message).toEqual('Invalid boolean key provided in Onyx update. Onyx key must be of type string.');
        }
    });

    it('should return all collection keys as a single object when waitForCollectionCallback = true', () => {
        const mockCallback = jest.fn();

        // GIVEN some initial collection data
        const initialCollectionData = {
            test_connect_collection_1: {
                ID: 123,
                value: 'one',
            },
            test_connect_collection_2: {
                ID: 234,
                value: 'two',
            },
            test_connect_collection_3: {
                ID: 345,
                value: 'three',
            },
        };

        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION, initialCollectionData);
        return waitForPromisesToResolve()
            .then(() => {
                // WHEN we connect to that collection with waitForCollectionCallback = true
                connectionID = Onyx.connect({
                    key: ONYX_KEYS.COLLECTION.TEST_CONNECT_COLLECTION,
                    waitForCollectionCallback: true,
                    callback: mockCallback,
                });
                return waitForPromisesToResolve();
            })
            .then(() => {
                // THEN we expect the callback to be called only once and the initial stored value to be initialCollectionData
                expect(mockCallback.mock.calls.length).toBe(1);
                expect(mockCallback.mock.calls[0][0]).toEqual(initialCollectionData);
            });
    });

    it('should return all collection keys as a single object when updating a collection key with waitForCollectionCallback = true', () => {
        const mockCallback = jest.fn();
        const collectionUpdate = {
            test_policy_1: {ID: 234, value: 'one'},
            test_policy_2: {ID: 123, value: 'two'},
        };

        // GIVEN an Onyx.connect call with waitForCollectionCallback=true
        connectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_POLICY,
            waitForCollectionCallback: true,
            callback: mockCallback,
        });
        return waitForPromisesToResolve()
            .then(() => {
                // WHEN we update the collection, e.g. the API returns a response
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_POLICY, collectionUpdate);
                return waitForPromisesToResolve();
            })
            .then(() => {
                // THEN we expect the callback to have called twice, once for the initial connect call + once for the collection update
                expect(mockCallback.mock.calls.length).toBe(2);

                // AND the value for the first call should be null since the collection was not initialized at that point
                expect(mockCallback.mock.calls[0][0]).toBe(null);

                // AND the value for the second call should be collectionUpdate since the collection was updated
                expect(mockCallback.mock.calls[1][0]).toEqual(collectionUpdate);
            });
    });
});
