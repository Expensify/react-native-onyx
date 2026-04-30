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
                initWithStoredValues: false,
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
                initWithStoredValues: false,
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
                initWithStoredValues: false,
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
                initWithStoredValues: false,
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
                initWithStoredValues: false,
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
            jest.useFakeTimers();
            try {
                StorageMock.setItem = jest.fn(StorageMock.setItem).mockRejectedValueOnce(genericError).mockImplementation(StorageMock.setItem);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                // Should be called once, since Storage.setItem failed only once
                expect(retryOperationSpy).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should stop retrying after MAX_STORAGE_OPERATION_RETRY_ATTEMPTS retries for failing operation', async () => {
            jest.useFakeTimers();
            try {
                StorageMock.setItem = jest.fn().mockRejectedValue(genericError);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                // Should be called 6 times: initial attempt + 5 retries (MAX_STORAGE_OPERATION_RETRY_ATTEMPTS)
                expect(retryOperationSpy).toHaveBeenCalledTimes(6);
            } finally {
                jest.useRealTimers();
            }
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

        it('should apply exponential backoff delay for non-capacity errors', async () => {
            jest.useFakeTimers();
            try {
                const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
                StorageMock.setItem = jest.fn().mockRejectedValue(genericError);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                // Filter setTimeout calls to only those from our wait() helper (delay > 0)
                const backoffDelays = setTimeoutSpy.mock.calls
                    .map((call) => call[1])
                    .filter((delay): delay is number => typeof delay === 'number' && delay > 0);

                // Should have 5 backoff delays (one before each of the 5 retries, attempts 0-4)
                // The 6th call to retryOperation (attempt 5) hits the MAX check and resolves without waiting
                expect(backoffDelays).toHaveLength(5);

                // Verify exponential growth pattern: each delay should be roughly double the previous
                // With ±25% jitter, delay[n+1] / delay[n] should be between ~1.2 and ~3.3
                for (let i = 1; i < backoffDelays.length; i++) {
                    const ratio = backoffDelays[i] / backoffDelays[i - 1];
                    expect(ratio).toBeGreaterThan(1.0);
                    expect(ratio).toBeLessThan(4.0);
                }

                setTimeoutSpy.mockRestore();
            } finally {
                jest.useRealTimers();
            }
        });

        it('should log connection error with backoff delay info', async () => {
            jest.useFakeTimers();
            try {
                const logInfoSpy = jest.spyOn(Logger, 'logInfo');
                const connectionError = new Error('Connection to Indexed Database server lost. Refresh the page to try again');
                StorageMock.setItem = jest.fn(StorageMock.setItem).mockRejectedValueOnce(connectionError).mockImplementation(StorageMock.setItem);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Connection error detected, retrying with backoff'));
                expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Connection to Indexed Database server lost'));
            } finally {
                jest.useRealTimers();
            }
        });

        it('should log recovery when connection error succeeds after backoff', async () => {
            jest.useFakeTimers();
            try {
                const logInfoSpy = jest.spyOn(Logger, 'logInfo');
                const connectionError = new Error('Connection to Indexed Database server lost. Refresh the page to try again');
                StorageMock.setItem = jest.fn(StorageMock.setItem).mockRejectedValueOnce(connectionError).mockImplementation(StorageMock.setItem);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Connection error recovered after backoff on attempt'));
            } finally {
                jest.useRealTimers();
            }
        });

        it('should log connection-specific exhaustion message when all retries fail', async () => {
            jest.useFakeTimers();
            try {
                const logAlertSpy = jest.spyOn(Logger, 'logAlert');
                const connectionError = new Error('Connection to Indexed Database server lost. Refresh the page to try again');
                StorageMock.setItem = jest.fn().mockRejectedValue(connectionError);

                const setPromise = Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});
                await jest.runAllTimersAsync();
                await setPromise;

                expect(logAlertSpy).toHaveBeenCalledWith(expect.stringContaining('Connection error exhausted all retries with backoff'));
            } finally {
                jest.useRealTimers();
            }
        });

        it('should NOT apply backoff delay for capacity errors (immediate retry with eviction)', async () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            StorageMock.setItem = jest.fn().mockRejectedValue(diskFullError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Capacity errors should not trigger any backoff delays (delay > 0)
            const backoffDelays = setTimeoutSpy.mock.calls
                .map((call) => call[1])
                .filter((delay): delay is number => typeof delay === 'number' && delay > 0);

            expect(backoffDelays).toHaveLength(0);
            setTimeoutSpy.mockRestore();
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
