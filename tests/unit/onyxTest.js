import Onyx from '../../index';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    ANOTHER_TEST: 'anotherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
    }
};

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
    initialKeyStates: {
        [ONYX_KEYS.ANOTHER_TEST]: 42,
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

        let anotherTestValue;
        const anotherTestConnectionID = Onyx.connect({
            key: ONYX_KEYS.ANOTHER_TEST,
            callback: (value) => {
                anotherTestValue = value;
            },
        });

        return waitForPromisesToResolve()
            .then(() => Onyx.set(ONYX_KEYS.TEST_KEY, 'test'))
            .then(() => {
                expect(testKeyValue).toBe('test');
                expect(anotherTestValue).toBe(42);
                return Onyx.clear().then(waitForPromisesToResolve);
            })
            .then(() => {
                expect(testKeyValue).toBeNull();
                expect(anotherTestValue).toBe(42);
                return Onyx.disconnect(anotherTestConnectionID);
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
                value: 'one'
            },
            test_2: {
                ID: 234,
                value: 'two'
            },
            test_3: {
                ID: 345,
                value: 'three'
            }
        })
            .then(() => (

                // 2 key values to update and 2 new keys to add.
                // MergeCollection will perform a mix of multiSet and multiMerge
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: {
                        ID: 123,
                        value: 'five'
                    },
                    test_2: {
                        ID: 234,
                        value: 'four'
                    },
                    test_4: {
                        ID: 456,
                        value: 'two'
                    },
                    test_5: {
                        ID: 567,
                        value: 'one'
                    }
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
            Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {test_1: {ID: 123}, not_my_test: {beep: 'boop'}});
        } catch (error) {
            // eslint-disable-next-line max-len
            expect(error.message).toEqual(`Provided collection does not have all its data belonging to the same parent. CollectionKey: ${ONYX_KEYS.COLLECTION.TEST_KEY}, DataKey: not_my_test`);
        }
    });
});
