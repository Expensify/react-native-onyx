import {measureAsyncFunction, measureFunction} from 'reassure';
import {createCollection} from '../utils/collections/createCollection';
import createRandomReportAction from '../utils/collections/reportActions';
import Onyx from '../../lib';
import StorageMock from '../../lib/storage';
import OnyxUtils from '../../lib/OnyxUtils';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_KEY_2: 'test2_',
        TEST_KEY_3: 'test3_',
        TEST_KEY_4: 'test4_',
        TEST_KEY_5: 'test5_',
        EVICTABLE_TEST_KEY: 'evictable_test_',
    },
};

const safeEvictionKeys = [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY];

const getMockedReportActions = (collection = ONYXKEYS.COLLECTION.TEST_KEY, length = 10000) =>
    createCollection<Record<string, unknown>>(
        (item) => `${collection}${item.reportActionID}`,
        (index) => createRandomReportAction(index),
        length,
    );

const mockedReportActionsMap = getMockedReportActions();

async function clearOnyxAfterRun(fn: () => Promise<unknown>): Promise<void> {
    await fn();
    return Onyx.clear();
}

describe('OnyxUtils', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            safeEvictionKeys,
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    afterEach(async () => {
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

    describe('resetDeferredInitTask', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.resetDeferredInitTask());
        });
    });

    describe('initStoreValues', () => {
        afterEach(() => {
            OnyxUtils.initStoreValues(ONYXKEYS, {}, safeEvictionKeys);
        });

        test('one call with 50k heavy objects', async () => {
            const data = {
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
            };

            await measureFunction(() => OnyxUtils.initStoreValues(ONYXKEYS, data, safeEvictionKeys));
        });
    });

    describe('sendActionToDevTools', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE_COLLECTION, undefined, mockedReportActionsMap));
        });
    });

    test('maybeFlushBatchUpdates', async () => {
        await measureFunction(() => undefined);
    });

    describe('batchUpdates', () => {
        // beforeEach(async () => {
        //     await Onyx.multiSet(mockedReportActionsMap);
        // });
        // test('one call with 5k sets and 5k merges updates', async () => {
        //     const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));
        //     const sets = Object.entries(changedReportActions)
        //         .filter(([, v]) => Number(v.reportActionID) % 2 === 0)
        //         .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.SET, value: v}));
        //     const merges = Object.entries(changedReportActions)
        //         .filter(([, v]) => Number(v.reportActionID) % 2 !== 0)
        //         .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.MERGE, value: v}));
        //     const updates = alternateLists(sets, merges) as OnyxUpdate[];
        //     await measureFunction(() => Onyx.update(updates));
        // });
    });

    describe('get', () => {
        test('10k calls with heavy objects', async () => {
            await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
            await measureAsyncFunction(() => clearOnyxAfterRun(() => Promise.all(Object.keys(mockedReportActionsMap).map((key) => OnyxUtils.get(key)))));
        });
    });

    describe('getAllKeys', () => {
        test('one call with 50k heavy objects', async () => {
            const data = {
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
            };

            await StorageMock.multiSet(Object.entries(data).map(([k, v]) => [k, v]));
            await measureAsyncFunction(() => clearOnyxAfterRun(OnyxUtils.getAllKeys));
        });
    });

    describe('getCollectionKeys', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.getCollectionKeys());
        });
    });

    describe('isCollectionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.isCollectionKey(ONYXKEYS.COLLECTION.TEST_KEY));
        });
    });

    describe('isCollectionMemberKey', () => {
        const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
        const collectionKeyLength = ONYXKEYS.COLLECTION.TEST_KEY.length;

        test('one call with correct key', async () => {
            await measureFunction(() => OnyxUtils.isCollectionMemberKey(collectionKey, `${collectionKey}entry1`, collectionKeyLength));
        });

        test('one call with wrong key', async () => {
            await measureFunction(() => OnyxUtils.isCollectionMemberKey(collectionKey, `${ONYXKEYS.COLLECTION.TEST_KEY_2}entry1`, collectionKeyLength));
        });
    });

    describe('splitCollectionMemberKey', () => {
        const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;

        test('one call without passing the collection key', async () => {
            await measureFunction(() => OnyxUtils.splitCollectionMemberKey(`${collectionKey}entry1`));
        });

        test('one call passing the collection key', async () => {
            await measureFunction(() => OnyxUtils.splitCollectionMemberKey(`${collectionKey}entry1`, collectionKey));
        });
    });

    describe('isKeyMatch', () => {
        const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;

        test('one call passing normal key', async () => {
            await measureFunction(() => OnyxUtils.isKeyMatch(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2));
        });

        test('one call passing collection key', async () => {
            await measureFunction(() => OnyxUtils.isKeyMatch(collectionKey, `${collectionKey}entry1`));
        });
    });

    describe('isSafeEvictionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxUtils.isSafeEvictionKey(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}entry1`));
        });
    });

    describe('tryGetCachedValue', () => {
        const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
        const key = `${collectionKey}0`;
        const reportAction = mockedReportActionsMap[`${collectionKey}0`];
        const collections = {
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3),
            ...getMockedReportActions(collectionKey),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
        };

        test('one call passing normal key without selector', async () => {
            await Onyx.set(key, reportAction);
            await measureFunction(() => OnyxUtils.tryGetCachedValue(key));
        });

        test('one call passing normal key with selector', async () => {
            await Onyx.set(key, reportAction);
            await measureFunction(() =>
                OnyxUtils.tryGetCachedValue(key, {
                    // @ts-expect-error bypass
                    selector: (value: Record<string, unknown>) => {
                        return {
                            reportActionID: value.reportActionID,
                            originalMessage: value.originalMessage,
                        };
                    },
                }),
            );
        });

        test('one call passing collection key without selector', async () => {
            await Onyx.multiSet(collections);
            await measureFunction(() => OnyxUtils.tryGetCachedValue(collectionKey));
        });

        test('one call passing collection key with selector', async () => {
            await Onyx.multiSet(collections);
            await measureFunction(() =>
                OnyxUtils.tryGetCachedValue(collectionKey, {
                    // @ts-expect-error bypass
                    selector: (value: Record<string, unknown>) => {
                        return {
                            reportActionID: value.reportActionID,
                            originalMessage: value.originalMessage,
                        };
                    },
                }),
            );
        });
    });

    describe('removeLastAccessedKey', () => {
        afterEach(() => {
            Object.keys(mockedReportActionsMap).forEach((key) => OnyxUtils.removeLastAccessedKey(key));
        });

        test('one call', async () => {
            Object.keys(mockedReportActionsMap).forEach((key) => OnyxUtils.addLastAccessedKey(key));
            await measureFunction(() => OnyxUtils.removeLastAccessedKey(`${ONYXKEYS.COLLECTION.TEST_KEY}5000`));
        });
    });

    describe('addLastAccessedKey', () => {
        afterEach(() => {
            Object.keys(mockedReportActionsMap).forEach((key) => OnyxUtils.removeLastAccessedKey(key));
        });

        test('one call', async () => {
            Object.keys(mockedReportActionsMap).forEach((key) => OnyxUtils.addLastAccessedKey(key));
            await measureFunction(() => OnyxUtils.addLastAccessedKey(`${ONYXKEYS.COLLECTION.TEST_KEY}5000`));
        });
    });

    describe('addAllSafeEvictionKeysToRecentlyAccessedList', () => {
        const data = {
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
            ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
        };

        test('one call', async () => {
            await Onyx.multiSet(data);
            await measureAsyncFunction(() => clearOnyxAfterRun(OnyxUtils.addAllSafeEvictionKeysToRecentlyAccessedList));
        });
    });

    describe('getCachedCollection', () => {
        test('one call', async () => {
            const data = {
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3),
                ...mockedReportActionsMap,
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4),
                ...getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5),
            };

            await Onyx.multiSet(data);
            await measureFunction(() => OnyxUtils.getCachedCollection(ONYXKEYS.COLLECTION.TEST_KEY));
        });
    });

    test('keysChanged', async () => {
        await measureFunction(() => undefined);
    });

    test('keyChanged', async () => {
        await measureFunction(() => undefined);
    });

    test('sendDataToConnection', async () => {
        await measureFunction(() => undefined);
    });

    test('getCollectionKey', async () => {
        await measureFunction(() => undefined);
    });

    test('getCollectionDataAndSendAsObject', async () => {
        await measureFunction(() => undefined);
    });

    test('scheduleSubscriberUpdate', async () => {
        await measureFunction(() => undefined);
    });

    test('scheduleNotifyCollectionSubscribers', async () => {
        await measureFunction(() => undefined);
    });

    test('remove', async () => {
        await measureFunction(() => undefined);
    });

    test('reportStorageQuota', async () => {
        await measureFunction(() => undefined);
    });

    test('evictStorageAndRetry', async () => {
        await measureFunction(() => undefined);
    });

    test('broadcastUpdate', async () => {
        await measureFunction(() => undefined);
    });

    test('hasPendingMergeForKey', async () => {
        await measureFunction(() => undefined);
    });

    test('removeNullValues', async () => {
        await measureFunction(() => undefined);
    });

    test('prepareKeyValuePairsForStorage', async () => {
        await measureFunction(() => undefined);
    });

    test('applyMerge', async () => {
        await measureFunction(() => undefined);
    });

    test('initializeWithDefaultKeyStates', async () => {
        await measureFunction(() => undefined);
    });

    test('getSnapshotKey', async () => {
        await measureFunction(() => undefined);
    });

    test('multiGet', async () => {
        await measureFunction(() => undefined);
    });

    test('tupleGet', async () => {
        await measureFunction(() => undefined);
    });

    test('isValidNonEmptyCollectionForMerge', async () => {
        await measureFunction(() => undefined);
    });

    test('doAllCollectionItemsBelongToSameParent', async () => {
        await measureFunction(() => undefined);
    });

    test('subscribeToKey', async () => {
        await measureFunction(() => undefined);
    });

    test('unsubscribeFromKey', async () => {
        await measureFunction(() => undefined);
    });

    test('getEvictionBlocklist', async () => {
        await measureFunction(() => undefined);
    });

    test('getSkippableCollectionMemberIDs', async () => {
        await measureFunction(() => undefined);
    });

    test('setSkippableCollectionMemberIDs', async () => {
        await measureFunction(() => undefined);
    });

    test('storeKeyBySubscriptions', async () => {
        await measureFunction(() => undefined);
    });

    test('deleteKeyBySubscriptions', async () => {
        await measureFunction(() => undefined);
    });

    test('addKeyToRecentlyAccessedIfNeeded', async () => {
        await measureFunction(() => undefined);
    });

    test('reduceCollectionWithSelector', async () => {
        await measureFunction(() => undefined);
    });

    test('updateSnapshots', async () => {
        await measureFunction(() => undefined);
    });
});
