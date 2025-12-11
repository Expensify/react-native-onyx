import {measureAsyncFunction, measureFunction} from 'reassure';
import {randBoolean} from '@ngneat/falso';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import type {Selector} from '../../lib';
import Onyx from '../../lib';
import StorageMock from '../../lib/storage';
import OnyxCache from '../../lib/OnyxCache';
import OnyxUtils, {clearOnyxUtilsInternals} from '../../lib/OnyxUtils';
import type GenericCollection from '../utils/GenericCollection';
import type {OnyxUpdate} from '../../lib/Onyx';
import createDeferredTask from '../../lib/createDeferredTask';
import type {OnyxInputKeyValueMapping, RetriableOnyxOperation} from '../../lib/types';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_NESTED_KEY: 'test_nested_',
        TEST_NESTED_NESTED_KEY: 'test_nested_nested_',
        TEST_KEY_2: 'test2_',
        TEST_KEY_3: 'test3_',
        TEST_KEY_4: 'test4_',
        TEST_KEY_5: 'test5_',
        EVICTABLE_TEST_KEY: 'evictable_test_',
        SNAPSHOT: 'snapshot_',
    },
};

const evictableKeys = [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY];

const initialKeyStates = {};

// @ts-expect-error bypass
const generateTestSelector = (): Selector<string, unknown, unknown> => (value: Record<string, unknown>) => {
    return {
        reportActionID: value.reportActionID,
        originalMessage: value.originalMessage,
    };
};

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
const mockedReportActionsMap = getRandomReportActions(collectionKey);
const mockedReportActionsKeys = Object.keys(mockedReportActionsMap);

const clearOnyxAfterEachMeasure = async () => {
    clearOnyxUtilsInternals();
    await Onyx.clear();
};

describe('OnyxUtils', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            evictableKeys,
            initialKeyStates,
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    afterEach(async () => {
        clearOnyxUtilsInternals();
        await Onyx.clear();
    });

    describe('getMergeQueue', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getMergeQueue());
        });
    });

    describe('getMergeQueuePromise', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getMergeQueuePromise());
        });
    });

    describe('getDefaultKeyStates', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getDefaultKeyStates());
        });
    });

    describe('getDeferredInitTask', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getDeferredInitTask());
        });
    });

    describe('initStoreValues', () => {
        test('one call with 50k heavy objects', async () => {
            const data = {
                ...getRandomReportActions(collectionKey),
                ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
                ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3),
                ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
                ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
            };

            await measureFunction(() => OnyxUtils.initStoreValues(ONYXKEYS, data, evictableKeys), {
                afterEach: () => {
                    OnyxUtils.initStoreValues(ONYXKEYS, initialKeyStates, evictableKeys);
                },
            });
        });
    });

    describe('sendActionToDevTools', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE_COLLECTION, undefined, mockedReportActionsMap));
        });
    });

    describe('batchUpdates / maybeFlushBatchUpdates', () => {
        test('one call with 1k updates', async () => {
            const updates: Array<() => void> = Array.from({length: 1000}, () => jest.fn);
            await measureAsyncFunction(() => Promise.all(updates.map((update) => OnyxUtils.batchUpdates(update))));
        });
    });

    describe('get', () => {
        test('10k calls with heavy objects', async () => {
            await measureAsyncFunction(() => Promise.all(mockedReportActionsKeys.map((key) => OnyxUtils.get(key))), {
                beforeEach: async () => {
                    await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('getAllKeys', () => {
        test('one call with 50k heavy objects', async () => {
            await measureAsyncFunction(() => OnyxUtils.getAllKeys(), {
                beforeEach: async () => {
                    await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('getCollectionKeys', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getCollectionKeys());
        });
    });

    describe('isCollectionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.isCollectionKey(collectionKey));
        });
    });

    describe('isCollectionMemberKey', () => {
        test('one call with correct key', async () => {
            await measureFunction(() => OnyxUtils.isCollectionMemberKey(collectionKey, `${collectionKey}entry1`));
        });

        test('one call with wrong key', async () => {
            await measureFunction(() => OnyxUtils.isCollectionMemberKey(collectionKey, `${ONYXKEYS.COLLECTION.TEST_KEY_2}entry1`));
        });
    });

    describe('splitCollectionMemberKey', () => {
        test('one call without passing the collection key', async () => {
            await measureFunction(() => OnyxUtils.splitCollectionMemberKey(`${collectionKey}entry1`));
        });

        test('one call passing the collection key', async () => {
            await measureFunction(() => OnyxUtils.splitCollectionMemberKey(`${collectionKey}entry1`, collectionKey));
        });
    });

    describe('isKeyMatch', () => {
        test('one call passing normal key', async () => {
            await measureFunction(() => OnyxUtils.isKeyMatch(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2));
        });

        test('one call passing collection key', async () => {
            await measureFunction(() => OnyxUtils.isKeyMatch(collectionKey, `${collectionKey}entry1`));
        });
    });

    describe('isSafeEvictionKey', () => {
        test('one call checking one key', async () => {
            await measureFunction(() => OnyxCache.isEvictableKey(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`));
        });
    });

    describe('tryGetCachedValue', () => {
        const key = `${collectionKey}0`;
        const reportAction = mockedReportActionsMap[`${collectionKey}0`];
        const collections = {
            ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
            ...getRandomReportActions(collectionKey),
        };

        test('one call passing normal key', async () => {
            await measureFunction(() => OnyxUtils.tryGetCachedValue(key), {
                beforeEach: async () => {
                    await Onyx.set(key, reportAction);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        test('one call passing collection key', async () => {
            await measureFunction(() => OnyxUtils.tryGetCachedValue(collectionKey), {
                beforeEach: async () => {
                    await Onyx.multiSet(collections);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('removeLastAccessedKey', () => {
        test('one call removing one key', async () => {
            await measureFunction(() => OnyxCache.removeLastAccessedKey(`${collectionKey}5000`), {
                beforeEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.addLastAccessedKey(key, false));
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.removeLastAccessedKey(key));
                },
            });
        });
    });

    describe('addLastAccessedKey', () => {
        test('one call adding one key', async () => {
            await measureFunction(() => OnyxCache.addLastAccessedKey(`${collectionKey}5000`, false), {
                beforeEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.addLastAccessedKey(key, false));
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.removeLastAccessedKey(key));
                },
            });
        });
    });

    describe('addEvictableKeysToRecentlyAccessedList', () => {
        const data = {
            ...getRandomReportActions(collectionKey, 1000),
            ...getRandomReportActions(ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY, 1000),
        };
        const fakeMethodParameter = () => false;
        const fakePromiseMethodParameter = () => Promise.resolve(new Set(Object.keys(data)));

        test('one call adding 1k keys', async () => {
            await measureAsyncFunction(() => OnyxCache.addEvictableKeysToRecentlyAccessedList(fakeMethodParameter, fakePromiseMethodParameter), {
                beforeEach: async () => {
                    await Onyx.multiSet(data);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('getCachedCollection', () => {
        test('one call retrieving a collection with 5k heavy objects', async () => {
            const data = {
                ...getRandomReportActions(collectionKey, 5000),
                ...getRandomReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2, 5000),
            };

            await measureFunction(() => OnyxUtils.getCachedCollection(collectionKey), {
                beforeEach: async () => {
                    await Onyx.multiSet(data);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('partialSetCollection', () => {
        test('one call with 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, randBoolean() ? v : createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;
            await measureAsyncFunction(() => OnyxUtils.partialSetCollection({collectionKey, collection: changedReportActions}), {
                beforeEach: async () => {
                    await Onyx.setCollection(collectionKey, mockedReportActionsMap as GenericCollection);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('keysChanged', () => {
        test('one call with 10k heavy objects to update 10k subscribers', async () => {
            const subscriptionMap = new Map<string, number>();

            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;

            await measureFunction(() => OnyxUtils.keysChanged(collectionKey, changedReportActions, mockedReportActionsMap), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                    mockedReportActionsKeys.forEach((key) => {
                        const id = OnyxUtils.subscribeToKey({key, callback: jest.fn(), initWithStoredValues: false});
                        subscriptionMap.set(key, id);
                    });
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => {
                        const id = subscriptionMap.get(key);
                        if (id) {
                            OnyxUtils.unsubscribeFromKey(id);
                        }
                    });
                    subscriptionMap.clear();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('keyChanged', () => {
        test('one call with one heavy object to update 10k subscribers', async () => {
            const subscriptionIDs = new Set<number>();

            const key = `${collectionKey}0`;
            const previousReportAction = mockedReportActionsMap[`${collectionKey}0`];
            const changedReportAction = createRandomReportAction(Number(previousReportAction.reportActionID));

            await measureFunction(() => OnyxUtils.keyChanged(key, changedReportAction), {
                beforeEach: async () => {
                    await Onyx.set(key, previousReportAction);
                    for (let i = 0; i < 10000; i++) {
                        const id = OnyxUtils.subscribeToKey({key, callback: jest.fn(), initWithStoredValues: false});
                        subscriptionIDs.add(id);
                    }
                },
                afterEach: async () => {
                    subscriptionIDs.forEach((id) => {
                        OnyxUtils.unsubscribeFromKey(id);
                    });
                    subscriptionIDs.clear();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('sendDataToConnection', () => {
        test('one call with 10k heavy objects', async () => {
            let subscriptionID = -1;

            await measureFunction(
                () =>
                    OnyxUtils.sendDataToConnection(
                        {
                            key: collectionKey,
                            subscriptionID,
                            callback: jest.fn(),
                        },
                        mockedReportActionsMap,
                        undefined,
                    ),
                {
                    beforeEach: async () => {
                        await Onyx.multiSet(mockedReportActionsMap);
                        subscriptionID = OnyxUtils.subscribeToKey({key: collectionKey, callback: jest.fn(), initWithStoredValues: false});
                    },
                    afterEach: async () => {
                        if (subscriptionID) {
                            OnyxUtils.unsubscribeFromKey(subscriptionID);
                        }
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('getCollectionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getCollectionKey(`${ONYXKEYS.COLLECTION.TEST_NESTED_NESTED_KEY}entry1`));
        });
    });

    describe('getCollectionDataAndSendAsObject', () => {
        test('one call with 10k heavy objects', async () => {
            let subscriptionID = -1;

            await measureAsyncFunction(
                async () => {
                    const callback = createDeferredTask();

                    subscriptionID = OnyxUtils.subscribeToKey({
                        key: collectionKey,
                        callback: jest.fn(),
                        initWithStoredValues: false,
                    });

                    OnyxUtils.getCollectionDataAndSendAsObject(mockedReportActionsKeys, {
                        key: collectionKey,
                        subscriptionID,
                        callback: () => {
                            callback.resolve?.();
                        },
                    });

                    return callback.promise;
                },
                {
                    beforeEach: async () => {
                        await Onyx.multiSet(mockedReportActionsMap);
                    },
                    afterEach: async () => {
                        if (subscriptionID) {
                            OnyxUtils.unsubscribeFromKey(subscriptionID);
                        }
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('scheduleSubscriberUpdate', () => {
        test('10k calls scheduling updates', async () => {
            const subscriptionMap = new Map<string, number>();

            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;

            await measureAsyncFunction(() => Promise.all(Object.entries(changedReportActions).map(([key, value]) => OnyxUtils.scheduleSubscriberUpdate(key, value))), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                    mockedReportActionsKeys.forEach((key) => {
                        const id = OnyxUtils.subscribeToKey({key, callback: jest.fn(), initWithStoredValues: false});
                        subscriptionMap.set(key, id);
                    });
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => {
                        const id = subscriptionMap.get(key);
                        if (id) {
                            OnyxUtils.unsubscribeFromKey(id);
                        }
                    });
                    subscriptionMap.clear();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('scheduleNotifyCollectionSubscribers', () => {
        test('one call with 10k heavy objects to update 10k subscribers', async () => {
            const subscriptionMap = new Map<string, number>();

            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;

            await measureAsyncFunction(() => OnyxUtils.scheduleNotifyCollectionSubscribers(collectionKey, changedReportActions, mockedReportActionsMap), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                    mockedReportActionsKeys.forEach((key) => {
                        const id = OnyxUtils.subscribeToKey({key, callback: jest.fn(), initWithStoredValues: false});
                        subscriptionMap.set(key, id);
                    });
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => {
                        const id = subscriptionMap.get(key);
                        if (id) {
                            OnyxUtils.unsubscribeFromKey(id);
                        }
                    });
                    subscriptionMap.clear();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('remove', () => {
        test('10k calls', async () => {
            await measureAsyncFunction(() => Promise.all(mockedReportActionsKeys.map((key) => OnyxUtils.remove(key))), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: async () => {
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('reportStorageQuota', () => {
        test('one call', async () => {
            await measureAsyncFunction(() => OnyxUtils.reportStorageQuota());
        });
    });

    describe('retryOperation', () => {
        test('one call', async () => {
            const error = new Error();
            const onyxMethod = jest.fn() as RetriableOnyxOperation;

            await measureAsyncFunction(() => OnyxUtils.retryOperation(error, onyxMethod, {key: '', value: null}, 1), {
                beforeEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.addLastAccessedKey(key, false));
                    OnyxCache.addLastAccessedKey(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}1`, false);
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => OnyxCache.removeLastAccessedKey(key));
                    OnyxCache.removeLastAccessedKey(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}1`);
                },
            });
        });
    });

    describe('broadcastUpdate', () => {
        test('one call', async () => {
            const key = `${collectionKey}0`;
            const reportAction = mockedReportActionsMap[`${collectionKey}0`];
            const changedReportAction = createRandomReportAction(Number(reportAction.reportActionID));

            await measureAsyncFunction(() => OnyxUtils.broadcastUpdate(key, changedReportAction, true), {
                beforeEach: async () => {
                    await Onyx.set(key, reportAction);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('hasPendingMergeForKey', () => {
        test('one call to look through 10k pending merges', async () => {
            await measureFunction(() => OnyxUtils.hasPendingMergeForKey(`${collectionKey}5000`), {
                beforeEach: async () => {
                    mockedReportActionsKeys.forEach((key) => {
                        OnyxUtils.getMergeQueue()[key] = [{}];
                    });
                },
                afterEach: async () => {
                    mockedReportActionsKeys.forEach((key) => {
                        delete OnyxUtils.getMergeQueue()[key];
                    });
                },
            });
        });
    });

    describe('prepareKeyValuePairsForStorage', () => {
        test('one call with 10k heavy objects', async () => {
            await measureFunction(() => OnyxUtils.prepareKeyValuePairsForStorage(mockedReportActionsMap, false));
        });
    });

    describe('mergeChanges', () => {
        test('one call merging 5 changes', async () => {
            const reportAction = mockedReportActionsMap[`${collectionKey}0`];
            const changedReportAction1 = createRandomReportAction(Number(reportAction.reportActionID));
            const changedReportAction2 = createRandomReportAction(Number(reportAction.reportActionID));
            const changedReportAction3 = createRandomReportAction(Number(reportAction.reportActionID));
            const changedReportAction4 = createRandomReportAction(Number(reportAction.reportActionID));
            const changedReportAction5 = createRandomReportAction(Number(reportAction.reportActionID));

            await measureFunction(() => OnyxUtils.mergeChanges([changedReportAction1, changedReportAction2, changedReportAction3, changedReportAction4, changedReportAction5], reportAction));
        });
    });

    describe('initializeWithDefaultKeyStates', () => {
        test('one call initializing 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;

            await measureAsyncFunction(() => OnyxUtils.initializeWithDefaultKeyStates(), {
                beforeEach: async () => {
                    await StorageMock.multiSet(Object.entries(changedReportActions).map(([k, v]) => [k, v]));
                    OnyxUtils.initStoreValues(ONYXKEYS, mockedReportActionsMap, evictableKeys);
                },
                afterEach: async () => {
                    await clearOnyxAfterEachMeasure();
                    OnyxUtils.initStoreValues(ONYXKEYS, initialKeyStates, evictableKeys);
                },
            });
        });
    });

    describe('getSnapshotKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getSnapshotKey());
        });
    });

    describe('multiGet', () => {
        test('one call getting 10k heavy objects from storage', async () => {
            await measureAsyncFunction(() => OnyxUtils.multiGet(mockedReportActionsKeys), {
                beforeEach: async () => {
                    await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        test('one call getting 10k heavy objects from cache', async () => {
            await measureAsyncFunction(() => OnyxUtils.multiGet(mockedReportActionsKeys), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('tupleGet', () => {
        test('one call getting 10k heavy objects', async () => {
            await measureFunction(() => OnyxUtils.tupleGet(mockedReportActionsKeys), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('isValidNonEmptyCollectionForMerge', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.isValidNonEmptyCollectionForMerge(mockedReportActionsMap as GenericCollection));
        });
    });

    describe('doAllCollectionItemsBelongToSameParent', () => {
        test('one call checking 10k heavy objects', async () => {
            await measureFunction(() => OnyxUtils.doAllCollectionItemsBelongToSameParent(collectionKey, mockedReportActionsKeys));
        });
    });

    describe('subscribeToKey', () => {
        test('one call subscribing to a single key', async () => {
            let subscriptionID = -1;

            await measureAsyncFunction(
                async () => {
                    const callback = createDeferredTask();
                    subscriptionID = OnyxUtils.subscribeToKey({
                        key: `${collectionKey}0`,
                        callback: () => {
                            callback.resolve?.();
                        },
                    });
                    return callback.promise;
                },
                {
                    beforeEach: async () => {
                        await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                    },
                    afterEach: async () => {
                        OnyxUtils.unsubscribeFromKey(subscriptionID);
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });

        test('one call subscribing to a whole collection of 10k heavy objects', async () => {
            let subscriptionID = -1;

            await measureAsyncFunction(
                async () => {
                    const callback = createDeferredTask();
                    subscriptionID = OnyxUtils.subscribeToKey({
                        key: collectionKey,
                        callback: () => {
                            callback.resolve?.();
                        },
                        waitForCollectionCallback: true,
                    });
                    return callback.promise;
                },
                {
                    beforeEach: async () => {
                        await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                    },
                    afterEach: async () => {
                        OnyxUtils.unsubscribeFromKey(subscriptionID);
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('unsubscribeFromKey', () => {
        test('one call', async () => {
            const key = `${collectionKey}0`;
            let subscriptionID = -1;

            await measureFunction(() => OnyxUtils.unsubscribeFromKey(subscriptionID), {
                beforeEach: async () => {
                    subscriptionID = OnyxUtils.subscribeToKey({
                        key,
                        initWithStoredValues: false,
                    });
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('getEvictionBlocklist', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxCache.getEvictionBlocklist());
        });
    });

    describe('getSkippableCollectionMemberIDs', () => {
        test('one call', async () => {
            const skippableCollectionMemberIDs = OnyxUtils.getSkippableCollectionMemberIDs();
            await measureFunction(() => OnyxUtils.getSkippableCollectionMemberIDs(), {
                beforeEach: async () => {
                    OnyxUtils.setSkippableCollectionMemberIDs(new Set([collectionKey, ONYXKEYS.COLLECTION.TEST_KEY_2]));
                },
                afterEach: async () => {
                    OnyxUtils.setSkippableCollectionMemberIDs(skippableCollectionMemberIDs);
                },
            });
        });
    });

    describe('setSkippableCollectionMemberIDs', () => {
        test('one call', async () => {
            const skippableCollectionMemberIDs = OnyxUtils.getSkippableCollectionMemberIDs();
            await measureFunction(() => OnyxUtils.setSkippableCollectionMemberIDs(new Set([collectionKey, ONYXKEYS.COLLECTION.TEST_KEY_2])), {
                afterEach: async () => {
                    OnyxUtils.setSkippableCollectionMemberIDs(skippableCollectionMemberIDs);
                },
            });
        });
    });

    describe('storeKeyBySubscriptions', () => {
        test('one call', async () => {
            const key = `${collectionKey}0`;
            let subscriptionID = -1;

            await measureFunction(() => OnyxUtils.storeKeyBySubscriptions(key, subscriptionID), {
                beforeEach: async () => {
                    subscriptionID = OnyxUtils.subscribeToKey({
                        key,
                        initWithStoredValues: false,
                    });
                },
                afterEach: async () => {
                    OnyxUtils.deleteKeyBySubscriptions(subscriptionID);
                    OnyxUtils.unsubscribeFromKey(subscriptionID);
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('deleteKeyBySubscriptions', () => {
        test('one call', async () => {
            const key = `${collectionKey}0`;
            let subscriptionID = -1;

            await measureFunction(() => OnyxUtils.deleteKeyBySubscriptions(subscriptionID), {
                beforeEach: async () => {
                    subscriptionID = OnyxUtils.subscribeToKey({
                        key,
                        initWithStoredValues: false,
                    });
                    OnyxUtils.storeKeyBySubscriptions(key, subscriptionID);
                },
                afterEach: async () => {
                    OnyxUtils.unsubscribeFromKey(subscriptionID);
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('addKeyToRecentlyAccessedIfNeeded', () => {
        test('one call', async () => {
            const key = `${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}0`;

            await measureFunction(() => OnyxUtils.addKeyToRecentlyAccessedIfNeeded(key), {
                afterEach: async () => {
                    OnyxCache.removeLastAccessedKey(key);
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('reduceCollectionWithSelector', () => {
        test('one call with 10k heavy objects', async () => {
            const selector = generateTestSelector();
            await measureFunction(() => OnyxUtils.reduceCollectionWithSelector(mockedReportActionsMap, selector));
        });
    });

    describe('updateSnapshots', () => {
        test('one call with 100 updates', async () => {
            const updates: OnyxUpdate[] = [];
            for (let i = 0; i < 100; i++) {
                updates.push({
                    onyxMethod: OnyxUtils.METHOD.MERGE,
                    key: `${collectionKey}${i}`,
                    value: createRandomReportAction(i),
                });
            }

            await measureAsyncFunction(() => Promise.all(OnyxUtils.updateSnapshots(updates, Onyx.merge).map((p) => p())), {
                beforeEach: async () => {
                    const searchData: Partial<OnyxInputKeyValueMapping> = {};
                    const data: Partial<OnyxInputKeyValueMapping> = {
                        ...mockedReportActionsMap,
                        [`${ONYXKEYS.COLLECTION.SNAPSHOT}hash0`]: {
                            data: searchData,
                            search: {},
                        },
                    };

                    for (let i = 0; i < 100; i++) {
                        searchData[`${collectionKey}${i}`] = mockedReportActionsMap[`${collectionKey}${i}`];
                    }

                    await Onyx.multiSet(data);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });
});
