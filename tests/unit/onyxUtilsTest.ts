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

    describe('skippable member subscriptions', () => {
        const BASE = ONYXKEYS.COLLECTION.TEST_KEY;

        beforeEach(() => {
            // Enable skipping of undefined member IDs for these tests
            OnyxUtils.setSkippableCollectionMemberIDs(new Set(['undefined']));
        });

        afterEach(() => {
            // Restore to no skippable IDs to avoid affecting other tests
            OnyxUtils.setSkippableCollectionMemberIDs(new Set());
        });

        it('does not emit initial callback for report_undefined member', async () => {
            const key = `${BASE}undefined`;
            const callback = jest.fn();
            Onyx.connect({key, callback});

            // Flush async subscription flow
            await act(async () => waitForPromisesToResolve());

            // No initial data should be sent for a skippable member
            expect(callback).not.toHaveBeenCalled();
        });

        it('still emits for valid member keys', async () => {
            const key = `${BASE}123`;
            await Onyx.set(key, {id: 123});

            const callback = jest.fn();
            Onyx.connect({key, callback});
            await act(async () => waitForPromisesToResolve());
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({id: 123}, key);
        });

        it('omits skippable members from base collection', async () => {
            const undefinedKey = `${BASE}undefined`;
            const validKey = `${BASE}1`;

            await Onyx.set(undefinedKey, {bad: true});
            await Onyx.set(validKey, {ok: true});

            let received: Record<string, unknown> | undefined;
            Onyx.connect({
                key: BASE,
                waitForCollectionCallback: true,
                callback: (value) => {
                    received = value as Record<string, unknown>;
                },
            });
            await act(async () => waitForPromisesToResolve());
            expect(received).toEqual({[validKey]: {ok: true}});
            expect(Object.keys(received ?? {})).not.toContain(undefinedKey);
        });

        it('does not register an active subscription in callbackToStateMapping for a skippable member', async () => {
            const skippableKey = `${BASE}undefined`;
            Onyx.connect({key: skippableKey, callback: jest.fn()});

            await act(async () => waitForPromisesToResolve());

            const mappings = OnyxUtils.getCallbackToStateMapping();
            const hasActiveSubscription = Object.values(mappings).some((m) => m.key === skippableKey);
            expect(hasActiveSubscription).toBe(false);
        });
    });

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

            await OnyxUtils.partialSetCollection({collectionKey: ONYXKEYS.COLLECTION.ROUTES, collection: {} as GenericCollection});

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

            const connFailing = Onyx.connect({key: entryKey, callback: failingCallback, reuseConnection: false});
            const connWorking = Onyx.connect({key: entryKey, callback: workingCallback, reuseConnection: false});
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
            expect(LocalOnyxCache.get(ONYXKEYS.TEST_KEY)).toEqual({test: 'not evictable'});
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

            await storage.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}pre1`, {id: 'pre1'});
            await storage.setItem(`${ONYXKEYS.COLLECTION.TEST_KEY}pre2`, {id: 'pre2'});

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
