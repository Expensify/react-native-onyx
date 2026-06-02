import {act} from '@testing-library/react-native';
import Onyx from '../../lib';
import OnyxUtils from '../../lib/OnyxUtils';
import type {GenericDeepRecord} from '../types';
import utils from '../../lib/utils';
import type {Collection, OnyxCollection} from '../../lib/types';
import type GenericCollection from '../utils/GenericCollection';
import OnyxCache from '../../lib/OnyxCache';
import * as Logger from '../../lib/Logger';
import StorageMock from '../../lib/storage';
import createDeferredTask from '../../lib/createDeferredTask';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const testObject: GenericDeepRecord = {
    a: 'a',
    b: {
        c: 'c',
        d: {
            e: 'e',
            f: 'f',
        },
        g: 'g',
    },
};

const testMergeChanges: GenericDeepRecord[] = [
    {
        b: {
            d: {
                h: 'h',
            },
        },
    },
    {
        b: {
            // Removing "d" object.
            d: null,
            h: 'h',
        },
    },
    {
        b: {
            // Adding back "d" property with a object.
            // The "ONYX_INTERNALS__REPLACE_OBJECT_MARK" marker property should be added here when batching merge changes.
            d: {
                i: 'i',
            },
        },
    },
    {
        b: {
            // Removing "d" object again.
            d: null,
            // Removing "g" object.
            g: null,
        },
    },
    {
        b: {
            // Adding back "d" property with a object.
            // The "ONYX_INTERNALS__REPLACE_OBJECT_MARK" marker property should be added here when batching merge changes.
            d: {
                i: 'i',
                j: 'j',
            },
            // Adding back "g" property with a object.
            // The "ONYX_INTERNALS__REPLACE_OBJECT_MARK" marker property should be added here when batching merge changes.
            g: {
                k: 'k',
            },
        },
    },
];

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_LEVEL_KEY: 'test_level_',
        TEST_LEVEL_LAST_KEY: 'test_level_last_',
        ROUTES: 'routes_',
        RAM_ONLY_COLLECTION: 'ramOnlyCollection_',
    },
    RAM_ONLY_KEY: 'ramOnlyKey',
};

describe('OnyxUtils', () => {
    beforeAll(() =>
        Onyx.init({
            keys: ONYXKEYS,
            ramOnlyKeys: [ONYXKEYS.RAM_ONLY_KEY, ONYXKEYS.COLLECTION.RAM_ONLY_COLLECTION],
        }),
    );

    beforeEach(() => Onyx.clear());

    afterEach(() => jest.clearAllMocks());

    describe('partialSetCollection', () => {
        beforeEach(() => {
            Onyx.clear();
        });

        afterEach(() => {
            Onyx.clear();
        });
        it('should replace all existing collection members with new values and keep old ones intact', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYXKEYS.COLLECTION.ROUTES}B`;
            const routeB1 = `${ONYXKEYS.COLLECTION.ROUTES}B1`;
            const routeC = `${ONYXKEYS.COLLECTION.ROUTES}C`;

            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            // Set initial collection state
            await Onyx.setCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB1]: {name: 'Route B1'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection);

            // Replace with new collection data
            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {
                    [routeA]: {name: 'New Route A'},
                    [routeB]: {name: 'New Route B'},
                    [routeC]: {name: 'New Route C'},
                } as GenericCollection,
            });

            expect(result).toEqual({
                [routeA]: {name: 'New Route A'},
                [routeB]: {name: 'New Route B'},
                [routeB1]: {name: 'Route B1'},
                [routeC]: {name: 'New Route C'},
            });
            await Onyx.disconnect(connection);
        });

        it('should not replace anything in the collection with empty values', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;

            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
            } as GenericCollection);

            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {} as GenericCollection,
            });

            expect(result).toEqual({
                [routeA]: {name: 'Route A'},
            });
            await Onyx.disconnect(connection);
        });

        it('should reject collection items with invalid keys', async () => {
            let result: OnyxCollection<unknown>;
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;
            const invalidRoute = 'invalid_route';

            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                callback: (value) => (result = value),
                waitForCollectionCallback: true,
            });

            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
            } as GenericCollection);

            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {
                    [invalidRoute]: {name: 'Invalid Route'},
                } as GenericCollection,
            });

            expect(result).toEqual({
                [routeA]: {name: 'Route A'},
            });

            await Onyx.disconnect(connection);
        });
    });

    describe('multiSetWithRetry', () => {
        it('should fire collection-level callback only once per collection even with multiple members', async () => {
            const collectionCallback = jest.fn();
            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback: collectionCallback,
                waitForCollectionCallback: true,
            });

            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            // multiSet with 3 members of the same collection
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: 2},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: 3},
            });

            // Should be called only ONCE with the batched collection (not 3 times)
            expect(collectionCallback).toHaveBeenCalledTimes(1);
            const [collection] = collectionCallback.mock.calls[0];
            expect(collection[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]).toEqual({id: 1});
            expect(collection[`${ONYXKEYS.COLLECTION.TEST_KEY}2`]).toEqual({id: 2});
            expect(collection[`${ONYXKEYS.COLLECTION.TEST_KEY}3`]).toEqual({id: 3});

            Onyx.disconnect(connection);
        });

        it('should fire individual member-key subscribers once per key', async () => {
            const spy1 = jest.fn();
            const spy2 = jest.fn();
            const spy3 = jest.fn();

            const conn1 = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.TEST_KEY}1`,
                callback: spy1,
            });
            const conn2 = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.TEST_KEY}2`,
                callback: spy2,
            });
            const conn3 = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.TEST_KEY}3`,
                callback: spy3,
            });
            await waitForPromisesToResolve();
            spy1.mockClear();
            spy2.mockClear();
            spy3.mockClear();

            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: 2},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: 3},
            });

            expect(spy1).toHaveBeenCalledTimes(1);
            expect(spy1).toHaveBeenCalledWith({id: 1}, `${ONYXKEYS.COLLECTION.TEST_KEY}1`);
            expect(spy2).toHaveBeenCalledTimes(1);
            expect(spy2).toHaveBeenCalledWith({id: 2}, `${ONYXKEYS.COLLECTION.TEST_KEY}2`);
            expect(spy3).toHaveBeenCalledTimes(1);
            expect(spy3).toHaveBeenCalledWith({id: 3}, `${ONYXKEYS.COLLECTION.TEST_KEY}3`);

            Onyx.disconnect(conn1);
            Onyx.disconnect(conn2);
            Onyx.disconnect(conn3);
        });

        it('should notify non-collection keys individually alongside batched collection updates', async () => {
            const collectionCallback = jest.fn();
            const singleKeyCallback = jest.fn();

            const connCollection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback: collectionCallback,
                waitForCollectionCallback: true,
            });
            const connSingle = Onyx.connect({
                key: ONYXKEYS.TEST_KEY,
                callback: singleKeyCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();
            singleKeyCallback.mockClear();

            // Mix of collection members and a non-collection key
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: 2},
                [ONYXKEYS.TEST_KEY]: 'standalone',
            });

            // Collection callback fires once (batched)
            expect(collectionCallback).toHaveBeenCalledTimes(1);
            // Non-collection key callback fires once
            expect(singleKeyCallback).toHaveBeenCalledTimes(1);
            expect(singleKeyCallback).toHaveBeenCalledWith('standalone', ONYXKEYS.TEST_KEY);

            Onyx.disconnect(connCollection);
            Onyx.disconnect(connSingle);
        });

        it('should batch notifications per-collection when members span multiple collections', async () => {
            const testCallback = jest.fn();
            const routesCallback = jest.fn();

            const connTest = Onyx.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback: testCallback,
                waitForCollectionCallback: true,
            });
            const connRoutes = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                callback: routesCallback,
                waitForCollectionCallback: true,
            });
            await waitForPromisesToResolve();
            testCallback.mockClear();
            routesCallback.mockClear();

            // multiSet with members of two different collections
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: 2},
                [`${ONYXKEYS.COLLECTION.ROUTES}A`]: {name: 'A'},
                [`${ONYXKEYS.COLLECTION.ROUTES}B`]: {name: 'B'},
            });

            // Each collection callback fires once
            expect(testCallback).toHaveBeenCalledTimes(1);
            expect(routesCallback).toHaveBeenCalledTimes(1);

            Onyx.disconnect(connTest);
            Onyx.disconnect(connRoutes);
        });

        it('should pass previous values to keysChanged so unchanged members skip notification', async () => {
            // Set initial data
            const initial1 = {id: 1, name: 'A'};
            const initial2 = {id: 2, name: 'B'};
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: initial1,
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: initial2,
            });

            const spy1 = jest.fn();
            const spy2 = jest.fn();
            const conn1 = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.TEST_KEY}1`,
                callback: spy1,
            });
            const conn2 = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.TEST_KEY}2`,
                callback: spy2,
            });
            await waitForPromisesToResolve();
            spy1.mockClear();
            spy2.mockClear();

            // multiSet: change key 1, keep key 2 with same content (but new reference)
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1, name: 'A-updated'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: initial2,
            });

            // Key 1 subscriber fires (value changed)
            expect(spy1).toHaveBeenCalledTimes(1);
            expect(spy1).toHaveBeenCalledWith({id: 1, name: 'A-updated'}, `${ONYXKEYS.COLLECTION.TEST_KEY}1`);

            // Key 2 keeps the same reference (passed as-is in multiSet) — subscriber should not fire
            // because keysChanged sees the same reference as previousCollection[key]
            expect(spy2).not.toHaveBeenCalled();

            Onyx.disconnect(conn1);
            Onyx.disconnect(conn2);
        });

        it('should stop firing callbacks for a collection subscriber that disconnects itself mid-batch', async () => {
            // A collection subscriber (waitForCollectionCallback=false) disconnects itself when
            // it receives the first member. Subsequent changed members in the same batch must NOT
            // trigger further callbacks for this subscriber.
            const callback = jest.fn();
            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback,
                waitForCollectionCallback: false,
            });
            await waitForPromisesToResolve();
            callback.mockReset();
            callback.mockImplementation(() => {
                Onyx.disconnect(connection);
            });

            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: 1},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: 2},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: 3},
            });

            // Despite 3 changed members, callback should fire at most once before disconnect stops it
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should keep cache and subscriber state consistent when a non-collection callback writes to another payload key', async () => {
            // A subscriber for keyA synchronously calls Onyx.set() on keyB during its callback.
            // After multiSet completes, the cache must reflect the multiSet's value for keyB
            // (multiSet wins), and the keyB subscriber's last seen value must equal the cache.
            await Onyx.multiSet({
                [ONYXKEYS.TEST_KEY]: 'initialA',
                [ONYXKEYS.TEST_KEY_2]: 'initialB',
            });

            const callbackA = jest.fn((value: unknown) => {
                if (value !== 'newA') {
                    return;
                }

                // While processing the new value of keyA, write to keyB.
                // keyB is later in the same multiSet payload — multiSet should win.
                Onyx.set(ONYXKEYS.TEST_KEY_2, 'callbackB');
            });
            const callbackB = jest.fn();

            const connA = Onyx.connect({
                key: ONYXKEYS.TEST_KEY,
                callback: callbackA,
            });
            const connB = Onyx.connect({
                key: ONYXKEYS.TEST_KEY_2,
                callback: callbackB,
            });
            await waitForPromisesToResolve();
            callbackA.mockClear();
            callbackB.mockClear();

            await Onyx.multiSet({
                [ONYXKEYS.TEST_KEY]: 'newA',
                [ONYXKEYS.TEST_KEY_2]: 'multiSetB',
            });

            // Cache reflects multiSet's payload value for keyB (the multiSet's later cache.set wins)
            expect(OnyxCache.get(ONYXKEYS.TEST_KEY_2)).toBe('multiSetB');

            expect(callbackB.mock.calls.length).toBe(2);
            expect(callbackB.mock.calls.at(0)?.[0]).toBe('callbackB');
            // keyB subscriber's last received value matches the cache (no stale callback)
            expect(callbackB.mock.calls.at(1)?.[0]).toBe('multiSetB');

            Onyx.disconnect(connA);
            Onyx.disconnect(connB);
        });
    });

    describe('keysChanged', () => {
        beforeEach(() => {
            Onyx.clear();
        });

        afterEach(() => {
            Onyx.clear();
        });

        it('should call callback when data actually changes for collection member key subscribers', async () => {
            const callbackSpy = jest.fn();
            const entryKey = `${ONYXKEYS.COLLECTION.TEST_KEY}123`;
            const connection = Onyx.connect({
                key: entryKey,
                callback: callbackSpy,
            });

            const entryData = {value: 'updated_data'};

            // Create partial collection data that includes our member key
            const collection = {
                [entryKey]: entryData,
            } as Collection<string, {value: string}>;

            // Clear the callback spy to focus on the keysChanged behavior
            callbackSpy.mockClear();

            await Onyx.setCollection(ONYXKEYS.COLLECTION.TEST_KEY, collection);

            // Verify the subscriber callback was called
            expect(callbackSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledWith(entryData, entryKey);

            await Onyx.disconnect(connection);
        });

        it('should set lastConnectionCallbackData for collection member key subscribers', async () => {
            const entryKey = `${ONYXKEYS.COLLECTION.TEST_KEY}456`;
            const initialEntryData = {value: 'initial_data'};
            const updatedEntryData = {value: 'updated_data'};
            const newEntryData = {value: 'new_data'};
            const callbackSpy = jest.fn();

            const connection = await Onyx.connect({
                key: entryKey,
                callback: callbackSpy,
            });

            // Create partial collection data that includes our member key
            const initialCollection = {
                [entryKey]: initialEntryData,
            } as Collection<string, {value: string}>;

            // Clear the callback spy to focus on the keysChanged behavior
            callbackSpy.mockClear();

            OnyxUtils.keysChanged(
                ONYXKEYS.COLLECTION.TEST_KEY,
                {[entryKey]: updatedEntryData}, // new collection
                initialCollection, // previous collection
            );

            // Should be called again because data changed
            expect(callbackSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledWith(undefined, entryKey);

            // Clear the callback spy to focus on the keyChanged behavior
            callbackSpy.mockClear();

            OnyxUtils.keyChanged(
                entryKey,
                newEntryData, // Second update with different data
                () => true, // notify connect subscribers
            );

            // Should be called again because data changed
            expect(callbackSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledWith(newEntryData, entryKey);

            await Onyx.disconnect(connection);
        });

        it('should notify collection-level subscribers with waitForCollectionCallback', async () => {
            const entryKey = `${ONYXKEYS.COLLECTION.TEST_KEY}789`;
            const entryData = {value: 'data'};

            const collectionCallback = jest.fn();
            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.TEST_KEY,
                callback: collectionCallback,
                waitForCollectionCallback: true,
            });

            await Onyx.set(entryKey, entryData);
            collectionCallback.mockClear();

            // Trigger keysChanged directly with a partial collection
            OnyxUtils.keysChanged(ONYXKEYS.COLLECTION.TEST_KEY, {[entryKey]: entryData}, {});

            expect(collectionCallback).toHaveBeenCalledTimes(1);
            // Collection subscriber receives the full cached collection, subscriber.key, and partial
            const [receivedCollection, receivedKey, receivedPartial] = collectionCallback.mock.calls[0];
            expect(receivedKey).toBe(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(receivedCollection[entryKey]).toEqual(entryData);
            expect(receivedPartial).toEqual({[entryKey]: entryData});

            Onyx.disconnect(connection);
        });

        it('should skip notification when member value has same reference in previous and current collection', async () => {
            const entryKey = `${ONYXKEYS.COLLECTION.TEST_KEY}same`;
            const sameValue = {value: 'unchanged'};

            await Onyx.set(entryKey, sameValue);

            const callbackSpy = jest.fn();
            const connection = Onyx.connect({
                key: entryKey,
                callback: callbackSpy,
            });
            await waitForPromisesToResolve();
            callbackSpy.mockClear();

            // Simulate keysChanged where the previous and current value are the SAME reference
            // (which happens with frozen snapshots when nothing changed). === should skip notification.
            OnyxUtils.keysChanged(ONYXKEYS.COLLECTION.TEST_KEY, {[entryKey]: sameValue}, {[entryKey]: sameValue});

            expect(callbackSpy).not.toHaveBeenCalled();

            Onyx.disconnect(connection);
        });

        it('should notify member subscribers only for changed keys in a batched update', async () => {
            const keyA = `${ONYXKEYS.COLLECTION.TEST_KEY}A`;
            const keyB = `${ONYXKEYS.COLLECTION.TEST_KEY}B`;
            const keyC = `${ONYXKEYS.COLLECTION.TEST_KEY}C`;

            const dataA = {value: 'A'};
            const dataB = {value: 'B'};
            const dataC = {value: 'C'};

            await Onyx.multiSet({[keyA]: dataA, [keyB]: dataB, [keyC]: dataC});

            const spyA = jest.fn();
            const spyB = jest.fn();
            const spyC = jest.fn();
            const connA = Onyx.connect({key: keyA, callback: spyA});
            const connB = Onyx.connect({key: keyB, callback: spyB});
            const connC = Onyx.connect({key: keyC, callback: spyC});
            await waitForPromisesToResolve();
            spyA.mockClear();
            spyB.mockClear();
            spyC.mockClear();

            // Update cache so keysChanged reads the new values via getCachedCollection
            const newA = {value: 'A-updated'};
            const newC = {value: 'C-updated'};
            OnyxCache.set(keyA, newA);
            OnyxCache.set(keyC, newC);
            // keyB stays the same reference

            OnyxUtils.keysChanged(ONYXKEYS.COLLECTION.TEST_KEY, {[keyA]: newA, [keyB]: dataB, [keyC]: newC}, {[keyA]: dataA, [keyB]: dataB, [keyC]: dataC});

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).not.toHaveBeenCalled();
            expect(spyC).toHaveBeenCalledTimes(1);

            Onyx.disconnect(connA);
            Onyx.disconnect(connB);
            Onyx.disconnect(connC);
        });

        it('should catch errors thrown by subscriber callbacks and continue notifying others', async () => {
            const entryKey = `${ONYXKEYS.COLLECTION.TEST_KEY}errorTest`;
            const entryData = {value: 'data'};

            await Onyx.set(entryKey, entryData);

            const failingCallback = jest.fn();
            const workingCallback = jest.fn();

            const connFailing = Onyx.connect({
                key: entryKey,
                callback: failingCallback,
                reuseConnection: false,
            });
            const connWorking = Onyx.connect({
                key: entryKey,
                callback: workingCallback,
                reuseConnection: false,
            });
            await waitForPromisesToResolve();
            failingCallback.mockReset();
            failingCallback.mockImplementation(() => {
                throw new Error('subscriber failure');
            });
            workingCallback.mockClear();

            // Spy on Logger to verify the error is logged
            const logSpy = jest.spyOn(Logger, 'logAlert').mockImplementation(() => undefined);

            const newData = {value: 'new'};
            // Update the cache so keysChanged sees the new value as different from previous
            OnyxCache.set(entryKey, newData);
            OnyxUtils.keysChanged(ONYXKEYS.COLLECTION.TEST_KEY, {[entryKey]: newData}, {[entryKey]: entryData});

            // Both callbacks should have been attempted; error should be logged
            expect(failingCallback).toHaveBeenCalled();
            expect(workingCallback).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalled();

            logSpy.mockRestore();
            Onyx.disconnect(connFailing);
            Onyx.disconnect(connWorking);
        });
    });

    describe('mergeChanges', () => {
        it("should return the last change if it's an array", () => {
            const {result} = OnyxUtils.mergeChanges([...testMergeChanges, [0, 1, 2]], testObject);

            expect(result).toEqual([0, 1, 2]);
        });

        it("should return the last change if the changes aren't objects", () => {
            const {result} = OnyxUtils.mergeChanges(['a', 0, 'b', 1], testObject);

            expect(result).toEqual(1);
        });

        it('should merge data correctly when applying batched changes', () => {
            const batchedChanges: GenericDeepRecord = {
                b: {
                    d: {
                        i: 'i',
                        j: 'j',
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                    },
                    h: 'h',
                    g: {
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        k: 'k',
                    },
                },
            };

            const {result} = OnyxUtils.mergeChanges([batchedChanges], testObject);

            expect(result).toEqual({
                a: 'a',
                b: {
                    c: 'c',
                    d: {
                        i: 'i',
                        j: 'j',
                    },
                    h: 'h',
                    g: {
                        k: 'k',
                    },
                },
            });
        });
    });

    describe('mergeAndMarkChanges', () => {
        it('should apply the replacement markers if we have properties with objects being removed and added back during the changes', () => {
            const {result, replaceNullPatches} = OnyxUtils.mergeAndMarkChanges(testMergeChanges);

            expect(result).toEqual({
                b: {
                    d: {
                        i: 'i',
                        j: 'j',
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                    },
                    h: 'h',
                    g: {
                        [utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true,
                        k: 'k',
                    },
                },
            });
            expect(replaceNullPatches).toEqual([
                [['b', 'd'], {i: 'i'}],
                [['b', 'd'], {i: 'i', j: 'j'}],
                [['b', 'g'], {k: 'k'}],
            ]);
        });
    });

    describe('retryOperation', () => {
        const retryOperationSpy = jest.spyOn(OnyxUtils, 'retryOperation');
        const genericError = new Error('Generic storage error');
        const invalidDataError = new Error("Failed to execute 'put' on 'IDBObjectStore': invalid data");
        const diskFullError = new Error('database or disk is full');
        const nonRetriableIdbError = Object.assign(new Error('Internal error opening backing store for indexedDB.open.'), {name: 'UnknownError'});

        it('should retry only one time if the operation is firstly failed and then passed', async () => {
            StorageMock.setItem = jest.fn(StorageMock.setItem).mockRejectedValueOnce(genericError).mockImplementation(StorageMock.setItem);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Should be called once, since Storage.setItem if failed only once
            expect(retryOperationSpy).toHaveBeenCalledTimes(1);
        });

        it('should stop retrying after MAX_STORAGE_OPERATION_RETRY_ATTEMPTS retries for failing operation', async () => {
            StorageMock.setItem = jest.fn().mockRejectedValue(genericError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Should be called 6 times: initial attempt + 5 retries (MAX_STORAGE_OPERATION_RETRY_ATTEMPTS)
            expect(retryOperationSpy).toHaveBeenCalledTimes(6);
        });

        it("should throw error for if operation failed with \"Failed to execute 'put' on 'IDBObjectStore': invalid data\" error", async () => {
            StorageMock.setItem = jest.fn().mockRejectedValueOnce(invalidDataError);

            await expect(Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'})).rejects.toThrow(invalidDataError);
        });

        it('should not retry in case of storage capacity error and no keys to evict', async () => {
            StorageMock.setItem = jest.fn().mockRejectedValue(diskFullError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Should only be called once since there are no evictable keys
            expect(retryOperationSpy).toHaveBeenCalledTimes(1);
        });

        it('should not retry for non-retriable IndexedDB backing-store errors', async () => {
            StorageMock.setItem = jest.fn().mockRejectedValue(nonRetriableIdbError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Called once (initial attempt only) -- no recursion, unlike the 6 calls for generic errors
            expect(retryOperationSpy).toHaveBeenCalledTimes(1);
        });

        it('should log a single skip alert for non-retriable errors', async () => {
            const logAlertSpy = jest.spyOn(Logger, 'logAlert');
            StorageMock.setItem = jest.fn().mockRejectedValue(nonRetriableIdbError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            expect(logAlertSpy).toHaveBeenCalledWith(`Storage operation skipped retry for non-retriable error. Error: ${nonRetriableIdbError}. onyxMethod: setWithRetry.`);
            // Not paired with the "5 retries exhausted" alert
            expect(logAlertSpy).toHaveBeenCalledTimes(1);
        });

        it('should include the error in logAlert for IDBObjectStore invalid data errors', async () => {
            const logAlertSpy = jest.spyOn(Logger, 'logAlert');
            StorageMock.setItem = jest.fn().mockRejectedValueOnce(invalidDataError);

            await expect(Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'})).rejects.toThrow(invalidDataError);

            expect(logAlertSpy).toHaveBeenCalledWith(`Attempted to set invalid data set in Onyx. Please ensure all data is serializable. Error: ${invalidDataError}`);
        });

        it('should include the error in logs when out of storage with no evictable keys', async () => {
            const logAlertSpy = jest.spyOn(Logger, 'logAlert');
            const logInfoSpy = jest.spyOn(Logger, 'logInfo');
            StorageMock.setItem = jest.fn().mockRejectedValue(diskFullError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            expect(logAlertSpy).toHaveBeenCalledWith(`Out of storage. But found no acceptable keys to remove. Error: ${diskFullError}`);
            expect(logInfoSpy).toHaveBeenCalledWith(`Storage Quota Check -- bytesUsed: 0 bytesRemaining: Infinity. Original error: ${diskFullError}`);
        });

        it('should include usageDetails in the storage quota log when available', async () => {
            const logInfoSpy = jest.spyOn(Logger, 'logInfo');
            const usageDetails = {
                caches: 1500160,
                fileSystem: 1369398,
                indexedDB: 10419711,
            };
            StorageMock.setItem = jest.fn().mockRejectedValue(diskFullError);
            StorageMock.getDatabaseSize = jest.fn().mockResolvedValue({
                bytesUsed: 13289269,
                bytesRemaining: 5000000,
                usageDetails,
            });

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            expect(logInfoSpy).toHaveBeenCalledWith(
                `Storage Quota Check -- bytesUsed: 13289269 bytesRemaining: 5000000 usageDetails: ${JSON.stringify(usageDetails)}. Original error: ${diskFullError}`,
            );
        });

        it('should include the error in logAlert when out of storage and getDatabaseSize fails', async () => {
            const dbSizeError = new Error('Failed to estimate storage');
            const logAlertSpy = jest.spyOn(Logger, 'logAlert');
            StorageMock.setItem = jest.fn().mockRejectedValue(diskFullError);
            StorageMock.getDatabaseSize = jest.fn().mockRejectedValue(dbSizeError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            expect(logAlertSpy).toHaveBeenCalledWith(`Unable to get database size. getDatabaseSize error: ${dbSizeError}. Original error: ${diskFullError}`);
        });

        it('should not re-add an evicted key to recentlyAccessedKeys after removal', async () => {
            // Re-init with evictable keys so getKeyForEviction() has something to return
            Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
            Onyx.init({
                keys: ONYXKEYS,
                evictableKeys: [ONYXKEYS.COLLECTION.TEST_KEY],
            });
            await waitForPromisesToResolve();

            const evictableKey = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;

            await Onyx.set(evictableKey, {id: 1});
            expect(OnyxCache.getKeyForEviction()).toBe(evictableKey);

            await OnyxUtils.remove(evictableKey);
            expect(OnyxCache.getKeyForEviction()).toBeUndefined();
        });
    });

    describe('mergeCollection cache-first ordering', () => {
        // Save originals so we can restore them after each test. The tests below replace
        // StorageMock.multiMerge / StorageMock.multiSet with rejecting mocks; without
        // restoring, the mock leaks into later describe blocks (e.g. eviction tests) whose
        // setup relies on these storage methods working normally.
        const originalMultiMerge = StorageMock.multiMerge;
        const originalMultiSet = StorageMock.multiSet;

        afterEach(() => {
            StorageMock.multiMerge = originalMultiMerge;
            StorageMock.multiSet = originalMultiSet;
        });

        it('updates cache and notifies subscribers even when Storage.multiMerge rejects', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const existingMemberKey = `${collectionKey}1`;
            const newMemberKey = `${collectionKey}2`;

            // Seed an existing member so the merge path exercises multiMerge (existing) + multiSet (new)
            await Onyx.set(existingMemberKey, {value: 'initial'});

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            // Force Storage.multiMerge to reject with a non-retriable IDB error so the failure
            // path is taken without burning the full retry budget and without rejecting the
            // outer Onyx.mergeCollection promise.
            const nonRetriableIdbError = Object.assign(new Error('Internal error opening backing store for indexedDB.open.'), {name: 'UnknownError'});
            StorageMock.multiMerge = jest.fn().mockRejectedValue(nonRetriableIdbError);

            await Onyx.mergeCollection(collectionKey, {
                [existingMemberKey]: {value: 'merged'},
                [newMemberKey]: {value: 'new'},
            } as GenericCollection);

            // Cache must reflect the merge regardless of the multiMerge rejection. This is the
            // cache-first / storage-second invariant that mergeCollectionWithPatches must honor.
            const cachedCollection = OnyxCache.getCollectionData(collectionKey);
            expect(cachedCollection?.[existingMemberKey]).toEqual({
                value: 'merged',
            });
            expect(cachedCollection?.[newMemberKey]).toEqual({value: 'new'});

            // Subscribers must have been notified with the merged values.
            expect(collectionCallback).toHaveBeenCalled();
            const lastBroadcast = collectionCallback.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
            expect(lastBroadcast?.[existingMemberKey]).toEqual({value: 'merged'});
            expect(lastBroadcast?.[newMemberKey]).toEqual({value: 'new'});
        });

        it('updates cache and notifies subscribers even when Storage.multiSet rejects', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const newMemberKey1 = `${collectionKey}1`;
            const newMemberKey2 = `${collectionKey}2`;

            // No keys are seeded, so every merged key is a "new" key. This forces the merge path
            // to use Storage.multiSet (existing keys would go through Storage.multiMerge).
            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            // Force Storage.multiSet to reject with a non-retriable IDB error so the failure
            // path is taken without burning the full retry budget and without rejecting the
            // outer Onyx.mergeCollection promise.
            const nonRetriableIdbError = Object.assign(new Error('Internal error opening backing store for indexedDB.open.'), {name: 'UnknownError'});
            StorageMock.multiSet = jest.fn().mockRejectedValue(nonRetriableIdbError);

            await Onyx.mergeCollection(collectionKey, {
                [newMemberKey1]: {value: 'first'},
                [newMemberKey2]: {value: 'second'},
            } as GenericCollection);

            // Cache must reflect the merge regardless of the multiSet rejection. This is the
            // cache-first / storage-second invariant that mergeCollectionWithPatches must honor.
            const cachedCollection = OnyxCache.getCollectionData(collectionKey);
            expect(cachedCollection?.[newMemberKey1]).toEqual({value: 'first'});
            expect(cachedCollection?.[newMemberKey2]).toEqual({value: 'second'});

            // Subscribers must have been notified with the merged values.
            expect(collectionCallback).toHaveBeenCalled();
            const lastBroadcast = collectionCallback.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
            expect(lastBroadcast?.[newMemberKey1]).toEqual({value: 'first'});
            expect(lastBroadcast?.[newMemberKey2]).toEqual({value: 'second'});
        });
    });

    describe('retry side-effect idempotency', () => {
        // Save originals so each test can replace StorageMock.multiMerge / StorageMock.multiSet
        // with a one-shot rejecting mock that triggers retryOperation's transient-error path.
        // Restoring keeps mocks from leaking into the storage-eviction describe block below.
        const originalMultiMerge = StorageMock.multiMerge;
        const originalMultiSet = StorageMock.multiSet;

        afterEach(() => {
            StorageMock.multiMerge = originalMultiMerge;
            StorageMock.multiSet = originalMultiSet;
        });

        // A retriable error: not in NON_RETRIABLE_ERRORS, not in STORAGE_ERRORS, so retryOperation
        // re-enters the failing method on the next attempt.
        const transientError = new Error('Transient storage error');

        it('mergeCollection — waitForCollectionCallback subscriber fires once across retries', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const existingMemberKey = `${collectionKey}1`;
            const newMemberKey = `${collectionKey}2`;

            await Onyx.set(existingMemberKey, {value: 'initial'});

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            StorageMock.multiMerge = jest.fn(originalMultiMerge).mockRejectedValueOnce(transientError);

            await Onyx.mergeCollection(collectionKey, {
                [existingMemberKey]: {value: 'merged'},
                [newMemberKey]: {value: 'new'},
            } as GenericCollection);

            // Before this fix, every retry attempt re-fired keysChanged() — and
            // waitForCollectionCallback subscribers fire on every keysChanged() call by contract.
            // After the fix, retries skip the keysChanged re-fire, so subscribers are notified
            // exactly once per logical operation.
            expect(collectionCallback).toHaveBeenCalledTimes(1);
        });

        it('Onyx.multiSet — collection subscriber fires once across retries', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const memberKey1 = `${collectionKey}1`;
            const memberKey2 = `${collectionKey}2`;

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            StorageMock.multiSet = jest.fn(originalMultiSet).mockRejectedValueOnce(transientError);

            await Onyx.multiSet({
                [memberKey1]: {value: 'first'},
                [memberKey2]: {value: 'second'},
            });

            expect(collectionCallback).toHaveBeenCalledTimes(1);
        });

        it('Onyx.setCollection — collection subscriber fires once across retries', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const memberKey1 = `${collectionKey}1`;
            const memberKey2 = `${collectionKey}2`;

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            StorageMock.multiSet = jest.fn(originalMultiSet).mockRejectedValueOnce(transientError);

            await Onyx.setCollection(collectionKey, {
                [memberKey1]: {value: 'first'},
                [memberKey2]: {value: 'second'},
            } as GenericCollection);

            expect(collectionCallback).toHaveBeenCalledTimes(1);
        });

        it('OnyxUtils.partialSetCollection — collection subscriber fires once across retries', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const memberKey1 = `${collectionKey}1`;
            const memberKey2 = `${collectionKey}2`;

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            StorageMock.multiSet = jest.fn(originalMultiSet).mockRejectedValueOnce(transientError);

            await OnyxUtils.partialSetCollection({
                collectionKey,
                collection: {
                    [memberKey1]: {value: 'first'},
                    [memberKey2]: {value: 'second'},
                } as GenericCollection,
            });

            expect(collectionCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('mergeCollection pre-warm', () => {
        // retryOperation tests above replace StorageMock methods without restoring them, leaving
        // rejecting mocks behind. Capture pristine refs at file-load time and restore in beforeEach
        // so our Onyx.set seeding actually reaches the in-memory storage provider.
        const pristineSetItem = StorageMock.setItem;
        const pristineMultiSet = StorageMock.multiSet;
        const pristineMultiGet = StorageMock.multiGet;
        const pristineGetItem = StorageMock.getItem;
        const pristineMultiMerge = StorageMock.multiMerge;

        beforeEach(() => {
            StorageMock.setItem = pristineSetItem;
            StorageMock.multiSet = pristineMultiSet;
            StorageMock.multiGet = pristineMultiGet;
            StorageMock.getItem = pristineGetItem;
            StorageMock.multiMerge = pristineMultiMerge;
        });

        // Make a key "cold" — value evicted from cache but still tracked as persisted. OnyxCache.drop
        // also removes the key from `storageKeys`, so we re-register it afterwards to reliably hit
        // the cold-but-persisted state regardless of getAllKeys()'s fallback path.
        const evictFromCache = (...keys: string[]) => {
            for (const key of keys) {
                OnyxCache.drop(key);
                OnyxCache.addKey(key);
            }
        };

        it('fast path: skips storage reads entirely when every existing key is warm in cache', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const existingKey1 = `${collectionKey}1`;
            const existingKey2 = `${collectionKey}2`;

            // Seed both members so they are both warm in cache and present in storage.
            await Onyx.set(existingKey1, {value: 'initial-1'});
            await Onyx.set(existingKey2, {value: 'initial-2'});

            const multiGetSpy = jest.spyOn(StorageMock, 'multiGet');
            const getItemSpy = jest.spyOn(StorageMock, 'getItem');

            await Onyx.mergeCollection(collectionKey, {
                [existingKey1]: {value: 'merged-1'},
                [existingKey2]: {value: 'merged-2'},
            } as GenericCollection);

            // With every existingKey warm, the diff swaps Promise.all(get) for Promise.resolve(),
            // so no storage reads should happen during the pre-warm.
            expect(multiGetSpy).not.toHaveBeenCalled();
            expect(getItemSpy).not.toHaveBeenCalled();

            // Cache still reflects the merge.
            const cached = OnyxCache.getCollectionData(collectionKey);
            expect(cached?.[existingKey1]).toEqual({value: 'merged-1'});
            expect(cached?.[existingKey2]).toEqual({value: 'merged-2'});
        });

        it('slow path: batches cold existing keys into a single Storage.multiGet, with no individual getItem calls', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const coldKey1 = `${collectionKey}1`;
            const coldKey2 = `${collectionKey}2`;
            const warmKey = `${collectionKey}3`;

            // Seed all three in storage, then evict two from cache so they are cold-but-persisted.
            await Onyx.set(coldKey1, {value: 'persisted-1'});
            await Onyx.set(coldKey2, {value: 'persisted-2'});
            await Onyx.set(warmKey, {value: 'persisted-3'});
            evictFromCache(coldKey1, coldKey2);

            // Reset spies AFTER seeding so we only count calls made during mergeCollection itself.
            const multiGetSpy = jest.spyOn(StorageMock, 'multiGet').mockClear();
            const getItemSpy = jest.spyOn(StorageMock, 'getItem').mockClear();

            await Onyx.mergeCollection(collectionKey, {
                [coldKey1]: {value: 'merged-1'},
                [coldKey2]: {value: 'merged-2'},
                [warmKey]: {value: 'merged-3'},
            } as GenericCollection);

            // OnyxUtils.multiGet filters to cache-missing keys before issuing Storage.multiGet, so we
            // expect exactly one batched read containing only the cold keys (the warm key is skipped).
            expect(multiGetSpy).toHaveBeenCalledTimes(1);
            const requestedKeys = multiGetSpy.mock.calls[0][0] as string[];
            expect(requestedKeys.sort()).toEqual([coldKey1, coldKey2].sort());

            // No individual Storage.getItem calls during pre-warm. Old code path would have fired one
            // get() per existing key, each potentially landing in Storage.getItem on cache miss.
            expect(getItemSpy).not.toHaveBeenCalled();
        });

        it('slow path: cold-cache merge layers the new delta on top of existing storage data (no field drops)', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const coldKey = `${collectionKey}1`;

            // Seed an object with multiple fields in storage, then evict from cache so the merge base
            // must come from a storage read — not from `undefined`.
            await Onyx.set(coldKey, {a: 1, b: 2});
            evictFromCache(coldKey);

            await Onyx.mergeCollection(collectionKey, {
                [coldKey]: {c: 3},
            } as GenericCollection);

            // If the pre-warm did NOT populate the cache from storage, fastMerge would treat the
            // previous value as undefined and the result would drop {a:1, b:2}. With the pre-warm
            // running multiGet on the cold key, the merge layers {c:3} on top of {a:1, b:2}.
            const cached = OnyxCache.getCollectionData(collectionKey);
            expect(cached?.[coldKey]).toEqual({a: 1, b: 2, c: 3});
        });

        it('warm cache: subscriber receives a single merged broadcast for an Onyx.update batch (no transient undefined)', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const existingKey = `${collectionKey}1`;

            await Onyx.set(existingKey, {value: 'initial'});

            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            await Onyx.update([
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: collectionKey,
                    value: {
                        [existingKey]: {value: 'merged'},
                    } as GenericCollection,
                },
            ]);

            // The fast path resolves the pre-warm synchronously (Promise.resolve()), preserving the
            // original promise-chain depth. The Onyx.update batch must therefore broadcast exactly
            // one merged value — not undefined first and the merged value on a later microtask.
            const broadcasts = collectionCallback.mock.calls.map((c) => c[0]);
            expect(broadcasts).toHaveLength(1);
            expect(broadcasts[0]?.[existingKey]).toEqual({value: 'merged'});
        });

        it('equivalence: warm-path and cold-path produce the same final cache state for the same merge', async () => {
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const memberKey = `${collectionKey}1`;
            const delta = {value: 'after'} as const;

            // Warm-path run.
            await Onyx.set(memberKey, {value: 'before', extra: 'kept'});
            await Onyx.mergeCollection(collectionKey, {
                [memberKey]: delta,
            } as GenericCollection);
            const warmResult = OnyxCache.getCollectionData(collectionKey)?.[memberKey];

            // Reset and replay with a cold cache before the merge.
            await Onyx.clear();
            await Onyx.set(memberKey, {value: 'before', extra: 'kept'});
            evictFromCache(memberKey);
            await Onyx.mergeCollection(collectionKey, {
                [memberKey]: delta,
            } as GenericCollection);
            const coldResult = OnyxCache.getCollectionData(collectionKey)?.[memberKey];

            expect(warmResult).toEqual(coldResult);
            expect(coldResult).toEqual({value: 'after', extra: 'kept'});
        });

        it('preserves cache-first invariant when Storage.multiGet rejects on the slow path', async () => {
            // A Storage.multiGet rejection during pre-warm must not skip the cache.merge() +
            // keysChanged() that follow. Without the .catch() at the pre-warm call site,
            // subscribers would miss the merge and Onyx.mergeCollection would reject.
            const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
            const coldMemberKey = `${collectionKey}1`;
            const newMemberKey = `${collectionKey}2`;

            // Seed an existing member, then evict it from cache so it's "tracked but unloaded" —
            // the slow path will try to multiGet it.
            await Onyx.set(coldMemberKey, {value: 'persisted'});
            evictFromCache(coldMemberKey);

            // Connect and flush the subscriber's initial load BEFORE installing the rejecting mock —
            // otherwise the connect's own multiGet (no .catch) consumes the mockRejectedValueOnce and
            // leaks an unhandled rejection instead of exercising the merge pre-warm path.
            const collectionCallback = jest.fn();
            Onyx.connect({
                key: collectionKey,
                waitForCollectionCallback: true,
                callback: collectionCallback,
            });
            await waitForPromisesToResolve();
            collectionCallback.mockClear();

            // The subscriber's connect re-populated cache, so re-evict to force the merge into
            // the slow (cold-key) path. Then reject the next Storage.multiGet so the pre-warm
            // read fails.
            evictFromCache(coldMemberKey);
            const transientError = new Error('Transient IndexedDB read error');
            StorageMock.multiGet = jest.fn(pristineMultiGet).mockRejectedValueOnce(transientError);

            // Outer promise must resolve, not reject, even when the pre-warm read fails.
            let outerRejected: unknown = null;
            const result = await Onyx.mergeCollection(collectionKey, {
                [coldMemberKey]: {merged: true},
                [newMemberKey]: {value: 'new'},
            } as GenericCollection).catch((e: unknown) => {
                outerRejected = e;
            });
            expect(outerRejected).toBeNull();
            expect(result).toBeUndefined();

            // cache.merge() + keysChanged() must still fire so subscribers see the merge. Use
            // toMatchObject because a concurrent read may have re-populated the persisted value;
            // what matters is that the new {merged: true} delta is applied on top.
            expect(collectionCallback).toHaveBeenCalled();
            const lastBroadcast = collectionCallback.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
            expect(lastBroadcast?.[coldMemberKey]).toMatchObject({merged: true});
            expect(lastBroadcast?.[newMemberKey]).toEqual({value: 'new'});
        });
    });

    describe('multiGet cache hit consistency', () => {
        // Same suite-pollution guard as the pre-warm block above — capture pristine StorageMock
        // refs at file-load time and restore them in beforeEach, since retryOperation tests leak.
        const pristineSetItem = StorageMock.setItem;
        const pristineMultiGet = StorageMock.multiGet;
        const pristineGetItem = StorageMock.getItem;

        beforeEach(() => {
            StorageMock.setItem = pristineSetItem;
            StorageMock.multiGet = pristineMultiGet;
            StorageMock.getItem = pristineGetItem;
        });

        it('does not re-fetch a cached falsy value from storage', async () => {
            const falsyKey = ONYXKEYS.TEST_KEY;

            // Seed cache with the falsy value 0 (a number, but the same logic applies to '',
            // false, and null). Using `Onyx.set` ensures the value lands in cache and storage.
            await Onyx.set(falsyKey, 0);

            // Spy on Storage methods to confirm multiGet does NOT round-trip to storage for
            // the cached falsy value.
            const multiGetSpy = jest.spyOn(StorageMock, 'multiGet');
            const getItemSpy = jest.spyOn(StorageMock, 'getItem');

            const result = await OnyxUtils.multiGet([falsyKey]);

            // The cached value must be returned without any storage read. Before this fix,
            // `if (cacheValue)` treated the cached 0 as a miss and triggered Storage.multiGet,
            // which would then overwrite the warm value via cache.merge().
            expect(multiGetSpy).not.toHaveBeenCalled();
            expect(getItemSpy).not.toHaveBeenCalled();
            expect(result.get(falsyKey)).toBe(0);
        });

        it('prefers cache when a concurrent write lands during the storage read', async () => {
            // Concurrent write during multiGet's storage read must not be overwritten by the
            // stale snapshot via cache.merge.
            const key = `${ONYXKEYS.COLLECTION.TEST_KEY}race`;

            OnyxCache.drop(key);
            OnyxCache.addKey(key);

            // Set cache inside the mock so it lands before Storage.multiGet's promise resolves —
            // multiGet's .then() then sees a populated cache and skips writing the stale value.
            StorageMock.multiGet = jest.fn().mockImplementation(() => {
                OnyxCache.set(key, {fresh: 'data'});
                return Promise.resolve([[key, {stale: 'a', alsoStale: 'b'}]]);
            });

            const result = await OnyxUtils.multiGet([key]);

            expect(OnyxCache.get(key)).toEqual({fresh: 'data'});
            expect(result.get(key)).toEqual({fresh: 'data'});
        });
    });

    describe('storage eviction', () => {
        const diskFullError = new Error('database or disk is full');

        // Use local references that get fresh instances after jest.resetModules()
        let LocalOnyx: typeof Onyx;
        let LocalOnyxUtils: typeof OnyxUtils;
        let LocalOnyxCache: typeof OnyxCache;
        let LocalStorageMock: typeof StorageMock;
        let LocalLogger: typeof Logger;

        // Reset all modules to get fresh singletons (OnyxCache, OnyxUtils, etc.)
        // then re-init Onyx with evictableKeys configured
        beforeEach(async () => {
            jest.resetModules();

            LocalOnyx = require('../../lib').default;
            LocalOnyxUtils = require('../../lib/OnyxUtils').default;
            LocalOnyxCache = require('../../lib/OnyxCache').default;
            LocalStorageMock = require('../../lib/storage').default;
            LocalLogger = require('../../lib/Logger');

            LocalOnyx.init({
                keys: ONYXKEYS,
                evictableKeys: [ONYXKEYS.COLLECTION.TEST_KEY],
            });
            await waitForPromisesToResolve();
        });

        it('should evict the least recently accessed evictable key on storage capacity error and retry successfully', async () => {
            const key1 = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;
            const key2 = `${ONYXKEYS.COLLECTION.TEST_KEY}2`;

            await LocalOnyx.set(key1, {id: 1});
            await LocalOnyx.set(key2, {id: 2});
            expect(LocalOnyxCache.hasCacheForKey(key1)).toBe(true);
            expect(LocalOnyxCache.hasCacheForKey(key2)).toBe(true);

            // Fail once with capacity error, then succeed
            LocalStorageMock.setItem = jest.fn(LocalStorageMock.setItem).mockRejectedValueOnce(diskFullError).mockImplementation(LocalStorageMock.setItem);

            await LocalOnyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // key1 was least recently accessed, so it should have been evicted
            expect(LocalOnyxCache.hasCacheForKey(key1)).toBe(false);
            // key2 was more recently accessed, so it should still be in cache
            expect(LocalOnyxCache.hasCacheForKey(key2)).toBe(true);
            // The write that triggered the error should have succeeded on retry
            expect(LocalOnyxCache.get(ONYXKEYS.TEST_KEY)).toEqual({test: 'data'});
        });

        it('should evict the least recently accessed key first (LRU order)', async () => {
            const key1 = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;
            const key2 = `${ONYXKEYS.COLLECTION.TEST_KEY}2`;
            const key3 = `${ONYXKEYS.COLLECTION.TEST_KEY}3`;

            // Set in order: key1, key2, key3
            await LocalOnyx.set(key1, {id: 1});
            await LocalOnyx.set(key2, {id: 2});
            await LocalOnyx.set(key3, {id: 3});

            // Now access key1 again so it becomes most recent
            await LocalOnyx.merge(key1, {id: 1, updated: true});

            // LRU order should now be: key2 (least recent), key3, key1 (most recent)
            expect(LocalOnyxCache.getKeyForEviction()).toBe(key2);
        });

        it('should not evict non-evictable keys', async () => {
            const evictableKey = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;

            await LocalOnyx.set(evictableKey, {id: 1});
            await LocalOnyx.set(ONYXKEYS.TEST_KEY, {test: 'not evictable'});

            // The evictable key should be a candidate for eviction
            expect(LocalOnyxCache.isEvictableKey(evictableKey)).toBe(true);
            // The non-evictable key should NOT be a candidate
            expect(LocalOnyxCache.isEvictableKey(ONYXKEYS.TEST_KEY)).toBe(false);

            // Evict it
            await LocalOnyxUtils.remove(evictableKey);

            // No more evictable candidates
            expect(LocalOnyxCache.getKeyForEviction()).toBeUndefined();
            // Non-evictable key should still be in cache
            expect(LocalOnyxCache.get(ONYXKEYS.TEST_KEY)).toEqual({
                test: 'not evictable',
            });
        });

        it('should not add collection keys to eviction candidates, only their members', async () => {
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;

            await LocalOnyx.set(memberKey, {id: 1});

            // The member key should be evictable
            expect(LocalOnyxCache.getKeyForEviction()).toBe(memberKey);

            // Attempting to add the collection key directly should be filtered out
            LocalOnyxCache.addLastAccessedKey(ONYXKEYS.COLLECTION.TEST_KEY, true);

            // Should still return the member key, not the collection key
            expect(LocalOnyxCache.getKeyForEviction()).toBe(memberKey);
        });

        it('should seed evictable keys from storage at init', async () => {
            // Set up storage with pre-existing evictable keys before init
            jest.resetModules();

            LocalOnyx = require('../../lib').default;
            LocalOnyxCache = require('../../lib/OnyxCache').default;
            const storage = require('../../lib/storage').default;

            await storage.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}pre1`, {
                id: 'pre1',
            });
            await storage.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}pre2`, {
                id: 'pre2',
            });

            // Init — addEvictableKeysToRecentlyAccessedList should seed them
            LocalOnyx.init({
                keys: ONYXKEYS,
                evictableKeys: [ONYXKEYS.COLLECTION.TEST_KEY],
            });
            await waitForPromisesToResolve();

            // Pre-existing keys should be available for eviction without being explicitly accessed
            const keyForEviction = LocalOnyxCache.getKeyForEviction();
            expect(keyForEviction).toBeDefined();
            expect(keyForEviction?.startsWith(ONYXKEYS.COLLECTION.TEST_KEY)).toBe(true);
        });

        it('should include the error in logs when evicting a key', async () => {
            const logInfoSpy = jest.spyOn(LocalLogger, 'logInfo');
            const key1 = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;

            await LocalOnyx.set(key1, {id: 1});

            LocalStorageMock.setItem = jest.fn(LocalStorageMock.setItem).mockRejectedValueOnce(diskFullError).mockImplementation(LocalStorageMock.setItem);

            await LocalOnyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            expect(logInfoSpy).toHaveBeenCalledWith(`Out of storage. Evicting least recently accessed key (${key1}) and retrying. Error: ${diskFullError}`);
            expect(logInfoSpy).toHaveBeenCalledWith(`Storage Quota Check -- bytesUsed: 0 bytesRemaining: Infinity. Original error: ${diskFullError}`);
        });

        it('multiSet — eviction of an UNRELATED key still notifies its subscribers (codex regression guard)', async () => {
            const evictableKey = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;
            const writeKey = `${ONYXKEYS.COLLECTION.TEST_KEY}2`;

            // Seed the evictable key first so it becomes the LRU evictable. The subsequent multiSet
            // writes a DIFFERENT key, so the evicted key is unrelated to the in-flight write.
            await LocalOnyx.set(evictableKey, {value: 'will-be-evicted'});
            expect(LocalOnyxCache.getKeyForEviction()).toBe(evictableKey);

            const subscriberCalls: unknown[] = [];
            LocalOnyx.connect({
                key: evictableKey,
                callback: (value) => subscriberCalls.push(value),
            });
            await waitForPromisesToResolve();
            subscriberCalls.length = 0;

            // Storage.multiSet rejects once with disk-full, then succeeds on retry.
            LocalStorageMock.multiSet = jest.fn(LocalStorageMock.multiSet).mockRejectedValueOnce(diskFullError).mockImplementation(LocalStorageMock.multiSet);

            await LocalOnyx.multiSet({[writeKey]: {value: 'new'}});

            // evictableKey was the LRU evictable, so retryOperation evicted it. It's not in the
            // in-flight write's keys, so the retry's cache.set won't restore it — subscribers MUST
            // see keyChanged(undefined) so they reflect the genuine removal (not stale value).
            expect(LocalOnyxCache.hasCacheForKey(evictableKey)).toBe(false);
            expect(subscriberCalls.at(-1)).toBeUndefined();
        });

        it('multiSet — eviction of an IN-FLIGHT key does not strand its subscriber', async () => {
            const memberKey = `${ONYXKEYS.COLLECTION.TEST_KEY}1`;

            // Seed memberKey so it becomes the LRU evictable. The multiSet below writes to the SAME
            // key, so eviction picks an in-flight key.
            await LocalOnyx.set(memberKey, {value: 'original'});
            expect(LocalOnyxCache.getKeyForEviction()).toBe(memberKey);

            const subscriberCalls: unknown[] = [];
            LocalOnyx.connect({
                key: memberKey,
                callback: (value) => subscriberCalls.push(value),
            });
            await waitForPromisesToResolve();
            subscriberCalls.length = 0;

            LocalStorageMock.multiSet = jest.fn(LocalStorageMock.multiSet).mockRejectedValueOnce(diskFullError).mockImplementation(LocalStorageMock.multiSet);

            await LocalOnyx.multiSet({[memberKey]: {value: 'updated'}});

            // The in-flight key was evicted then restored by the retry's cache.set. Subscriber's
            // last value must be the new value, never a transient undefined from the eviction.
            expect(LocalOnyxCache.get(memberKey)).toEqual({value: 'updated'});
            expect(subscriberCalls.at(-1)).toEqual({value: 'updated'});
            // Subscriber should never have seen undefined in the middle of the eviction-retry cycle.
            expect(subscriberCalls).not.toContain(undefined);
        });
    });

    describe('afterInit', () => {
        beforeEach(() => {
            // Resets the deferred init task before each test.
            Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
        });

        afterEach(() => {
            jest.restoreAllMocks();
            return Onyx.clear();
        });

        it('should execute the callback immediately if Onyx is already initialized', async () => {
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            const callback = jest.fn();
            OnyxUtils.afterInit(callback);

            await act(async () => waitForPromisesToResolve());

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should only execute the callback after Onyx initialization', async () => {
            const callback = jest.fn();
            OnyxUtils.afterInit(callback);

            await act(async () => waitForPromisesToResolve());

            expect(callback).not.toHaveBeenCalled();

            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});
