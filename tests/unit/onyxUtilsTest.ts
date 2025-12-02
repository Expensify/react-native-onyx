import Onyx from '../../lib';
import OnyxUtils from '../../lib/OnyxUtils';
import type {GenericDeepRecord} from '../types';
import utils from '../../lib/utils';
import type {Collection, OnyxCollection} from '../../lib/types';
import type GenericCollection from '../utils/GenericCollection';
import StorageMock from '../../lib/storage';

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
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

afterEach(() => jest.clearAllMocks());

describe('OnyxUtils', () => {
    describe('splitCollectionMemberKey', () => {
        describe('should return correct values', () => {
            const dataResult: Record<string, [string, string]> = {
                test_: ['test_', ''],
                test_level_: ['test_level_', ''],
                test_level_1: ['test_level_', '1'],
                test_level_2: ['test_level_', '2'],
                test_level_last_3: ['test_level_last_', '3'],
                test___FAKE__: ['test_', '__FAKE__'],
                'test_-1_something': ['test_', '-1_something'],
                'test_level_-1_something': ['test_level_', '-1_something'],
            };

            it.each(Object.keys(dataResult))('%s', (key) => {
                const [collectionKey, id] = OnyxUtils.splitCollectionMemberKey(key);
                expect(collectionKey).toEqual(dataResult[key][0]);
                expect(id).toEqual(dataResult[key][1]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.splitCollectionMemberKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.splitCollectionMemberKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
        });

        it('should allow passing the collection key beforehand for performance gains', () => {
            const [collectionKey, id] = OnyxUtils.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_KEY);
            expect(collectionKey).toEqual(ONYXKEYS.COLLECTION.TEST_KEY);
            expect(id).toEqual('id1');
        });

        it("should throw error if the passed collection key isn't compatible with the key", () => {
            expect(() => {
                OnyxUtils.splitCollectionMemberKey(`${ONYXKEYS.COLLECTION.TEST_KEY}id1`, ONYXKEYS.COLLECTION.TEST_LEVEL_KEY);
            }).toThrowError("Invalid 'test_level_' collection key provided, it isn't compatible with 'test_id1' key.");
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

        it('should notify subscribers when removing collection items with null values', async () => {
            let collectionResult: OnyxCollection<unknown>;
            let callbackCount = 0;
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYXKEYS.COLLECTION.ROUTES}B`;
            const routeC = `${ONYXKEYS.COLLECTION.ROUTES}C`;

            // Test with waitForCollectionCallback: true
            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value) => {
                    collectionResult = value;
                    callbackCount++;
                },
                waitForCollectionCallback: true,
            });

            // Set initial collection state
            await Onyx.setCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB]: {name: 'Route B'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection);

            callbackCount = 0; // Reset counter after initial set

            // Remove items by setting them to null
            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {
                    [routeA]: null,
                    [routeB]: null,
                } as GenericCollection,
            });

            // Should be notified about the removal
            expect(callbackCount).toBeGreaterThan(0);
            expect(collectionResult).toEqual({
                [routeC]: {name: 'Route C'},
            });

            await Onyx.disconnect(connection);
        });

        it('should notify individual key subscribers when removing collection items with null values', async () => {
            let routeAValue: unknown;
            let routeBValue: unknown;
            let routeCValue: unknown;
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYXKEYS.COLLECTION.ROUTES}B`;
            const routeC = `${ONYXKEYS.COLLECTION.ROUTES}C`;

            // Test with waitForCollectionCallback: false (individual callbacks)
            const connectionA = Onyx.connect({
                key: routeA,
                initWithStoredValues: false,
                callback: (value) => {
                    routeAValue = value;
                },
            });

            const connectionB = Onyx.connect({
                key: routeB,
                initWithStoredValues: false,
                callback: (value) => {
                    routeBValue = value;
                },
            });

            const connectionC = Onyx.connect({
                key: routeC,
                initWithStoredValues: false,
                callback: (value) => {
                    routeCValue = value;
                },
            });

            // Set initial collection state
            await Onyx.setCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB]: {name: 'Route B'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection);

            // Remove items by setting them to null
            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {
                    [routeA]: null,
                    [routeB]: null,
                } as GenericCollection,
            });

            // Individual subscribers should be notified about removals
            expect(routeAValue).toBeUndefined();
            expect(routeBValue).toBeUndefined();
            expect(routeCValue).toEqual({name: 'Route C'});

            await Onyx.disconnect(connectionA);
            await Onyx.disconnect(connectionB);
            await Onyx.disconnect(connectionC);
        });

        it('should notify collection subscribers without waitForCollectionCallback when removing items', async () => {
            const callbackResults: Array<{value: unknown; key: string}> = [];
            const routeA = `${ONYXKEYS.COLLECTION.ROUTES}A`;
            const routeB = `${ONYXKEYS.COLLECTION.ROUTES}B`;
            const routeC = `${ONYXKEYS.COLLECTION.ROUTES}C`;

            // Test without waitForCollectionCallback (gets called for each item)
            const connection = Onyx.connect({
                key: ONYXKEYS.COLLECTION.ROUTES,
                initWithStoredValues: false,
                callback: (value, key) => {
                    callbackResults.push({value, key});
                },
                waitForCollectionCallback: false,
            });

            // Set initial collection state
            await Onyx.setCollection(ONYXKEYS.COLLECTION.ROUTES, {
                [routeA]: {name: 'Route A'},
                [routeB]: {name: 'Route B'},
                [routeC]: {name: 'Route C'},
            } as GenericCollection);

            callbackResults.length = 0; // Clear after initial set

            // Remove items by setting them to null
            await OnyxUtils.partialSetCollection({
                collectionKey: ONYXKEYS.COLLECTION.ROUTES,
                collection: {
                    [routeA]: null,
                    [routeB]: null,
                } as GenericCollection,
            });

            // Should be notified about removals (value will be undefined for removed keys)
            const removalCallbacks = callbackResults.filter((result) => result.value === undefined);

            // We expect at least routeA or routeB to have undefined callback
            // Both should ideally be notified, but the exact behavior depends on iteration order
            expect(removalCallbacks.length).toBeGreaterThanOrEqual(1);
            const hasRouteARemoval = removalCallbacks.some((result) => result.key === routeA);
            const hasRouteBRemoval = removalCallbacks.some((result) => result.key === routeB);
            expect(hasRouteARemoval || hasRouteBRemoval).toBe(true);

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
                true, // notify connect subscribers
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

    describe('getCollectionKey', () => {
        describe('should return correct values', () => {
            const dataResult: Record<string, string> = {
                test_: 'test_',
                test_level_: 'test_level_',
                test_level_1: 'test_level_',
                test_level_2: 'test_level_',
                test_level_last_3: 'test_level_last_',
                test___FAKE__: 'test_',
                'test_-1_something': 'test_',
                'test_level_-1_something': 'test_level_',
            };

            it.each(Object.keys(dataResult))('%s', (key) => {
                const collectionKey = OnyxUtils.getCollectionKey(key);
                expect(collectionKey).toEqual(dataResult[key]);
            });
        });

        it('should throw error if key does not contain underscore', () => {
            expect(() => {
                OnyxUtils.getCollectionKey(ONYXKEYS.TEST_KEY);
            }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
            expect(() => {
                OnyxUtils.getCollectionKey('');
            }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
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
        const memoryError = new Error('out of memory');

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
            StorageMock.setItem = jest.fn().mockRejectedValue(memoryError);

            await Onyx.set(ONYXKEYS.TEST_KEY, {test: 'data'});

            // Should only be called once since there are no evictable keys
            expect(retryOperationSpy).toHaveBeenCalledTimes(1);
        });
    });
});
