import {measureAsyncFunction} from 'reassure';
import type {OnyxUpdate} from '../../lib';
import Onyx from '../../lib';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import type GenericCollection from '../utils/GenericCollection';
import OnyxUtils from '../../lib/OnyxUtils';
import createDeferredTask from '../../lib/createDeferredTask';
import alternateLists from '../utils/alternateLists';

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

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
const mockedReportActionsMap = getRandomReportActions(collectionKey);

const clearOnyxAfterEachMeasure = async () => {
    await Onyx.clear();
};

describe('Onyx', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    describe('set', () => {
        test('10k calls with heavy objects', async () => {
            await measureAsyncFunction(
                () =>
                    Promise.all(
                        Object.values(mockedReportActionsMap).map((reportAction) => {
                            return Onyx.set(`${collectionKey}${reportAction.reportActionID}`, reportAction);
                        }),
                    ),
                {afterEach: clearOnyxAfterEachMeasure},
            );
        });
    });

    describe('multiSet', () => {
        test('one call with 10k heavy objects', async () => {
            await measureAsyncFunction(() => Onyx.multiSet(mockedReportActionsMap), {afterEach: clearOnyxAfterEachMeasure});
        });
    });

    describe('merge', () => {
        test('10k calls with heavy objects', async () => {
            const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));
            await measureAsyncFunction(
                () =>
                    Promise.all(
                        Object.values(changedReportActions).map((changedReportAction) => {
                            return Onyx.merge(`${collectionKey}${changedReportAction.reportActionID}`, changedReportAction);
                        }),
                    ),
                {
                    beforeEach: async () => {
                        await Onyx.multiSet(mockedReportActionsMap);
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });
    });

    describe('mergeCollection', () => {
        test('one call with 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;
            await measureAsyncFunction(() => Onyx.mergeCollection(collectionKey, changedReportActions), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('setCollection', () => {
        test('one call with 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;
            await measureAsyncFunction(() => Onyx.setCollection(collectionKey, changedReportActions), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('update', () => {
        test('one call with 5k sets and 5k merges updates', async () => {
            const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));

            const sets = Object.entries(changedReportActions)
                .filter(([, v]) => Number(v.reportActionID) % 2 === 0)
                .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.SET, value: v}));

            const merges = Object.entries(changedReportActions)
                .filter(([, v]) => Number(v.reportActionID) % 2 !== 0)
                .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.MERGE, value: v}));

            const updates = alternateLists(sets, merges) as OnyxUpdate[];

            await measureAsyncFunction(() => Onyx.update(updates), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('clear', () => {
        test('one call with 10k records to clean', async () => {
            await measureAsyncFunction(() => Onyx.clear(), {
                beforeEach: async () => {
                    await Onyx.multiSet(mockedReportActionsMap);
                },
            });
        });
    });

    describe('init', () => {
        test('one call with 10k records to init', async () => {
            await measureAsyncFunction(
                () => {
                    Onyx.init({
                        keys: ONYXKEYS,
                        initialKeyStates: mockedReportActionsMap,
                        maxCachedKeysCount: 100000,
                        evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        skippableCollectionMemberIDs: ['skippable-id'],
                    });

                    return OnyxUtils.getDeferredInitTask().promise;
                },
                {
                    beforeEach: async () => {
                        Object.assign(OnyxUtils.getDeferredInitTask(), createDeferredTask());
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });
    });
});
