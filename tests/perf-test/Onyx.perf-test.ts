import {measureFunction} from 'reassure';
import type {OnyxUpdate} from '../../lib';
import Onyx from '../../lib';
import {createCollection} from '../utils/collections/createCollection';
import createRandomReportAction from '../utils/collections/reportActions';
import type GenericCollection from '../utils/GenericCollection';

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

const alternateLists = (list1: unknown[], list2: unknown[]) => {
    return list1.length > list2.length
        ? list1.flatMap((item, i) => [item, list2[i]]).filter((x) => x !== undefined)
        : list2.flatMap((item, i) => [list1[i], item]).filter((x) => x !== undefined);
};

const getMockedReportActions = (collection = ONYXKEYS.COLLECTION.TEST_KEY, length = 10000) =>
    createCollection<Record<string, unknown>>(
        (item) => `${collection}${item.reportActionID}`,
        (index) => createRandomReportAction(index),
        length,
    );

const mockedReportActionsMap = getMockedReportActions();

describe('Onyx', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            safeEvictionKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    test('connect', async () => {
        await measureFunction(() => undefined);
    });

    test('disconnect', async () => {
        await measureFunction(() => undefined);
    });

    describe('set', () => {
        test('one call with heavy object', async () => {
            const reportAction = createRandomReportAction(1);
            await measureFunction(() => Onyx.set(`${ONYXKEYS.COLLECTION.TEST_KEY}${reportAction.reportActionID}`, reportAction));
        });

        test('10k calls with heavy objects', async () => {
            await measureFunction(() =>
                Promise.all(
                    Object.values(mockedReportActionsMap).map((reportAction) => {
                        return Onyx.set(`${ONYXKEYS.COLLECTION.TEST_KEY}${reportAction.reportActionID}`, reportAction);
                    }),
                ),
            );
        });
    });

    describe('multiSet', () => {
        test('one call with one heavy object', async () => {
            const reportAction = createRandomReportAction(1);
            await measureFunction(() => Onyx.multiSet({[`${ONYXKEYS.COLLECTION.TEST_KEY}${reportAction.reportActionID}`]: reportAction}));
        });

        test('one call with 10k heavy objects', async () => {
            await measureFunction(() => Onyx.multiSet(mockedReportActionsMap));
        });
    });

    describe('merge', () => {
        beforeEach(async () => {
            await Onyx.multiSet(mockedReportActionsMap);
        });

        test('one call with heavy object', async () => {
            const reportAction = createRandomReportAction(1);
            await measureFunction(() => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}1`, reportAction));
        });

        test('10k calls with heavy objects', async () => {
            const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));
            await measureFunction(() =>
                Promise.all(
                    Object.values(changedReportActions).map((changedReportAction) => {
                        return Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}${changedReportAction.reportActionID}`, changedReportAction);
                    }),
                ),
            );
        });
    });

    describe('mergeCollection', () => {
        beforeEach(async () => {
            await Onyx.multiSet(mockedReportActionsMap);
        });

        test('one call with one heavy object', async () => {
            const changedReportAction = createRandomReportAction(1);
            await measureFunction(() => Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: changedReportAction} as GenericCollection));
        });

        test('one call with 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;
            await measureFunction(() => Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, changedReportActions));
        });
    });

    describe('setCollection', () => {
        beforeEach(async () => {
            await Onyx.multiSet(mockedReportActionsMap);
        });

        test('one call with one heavy object', async () => {
            const changedReportAction = createRandomReportAction(1);
            await measureFunction(() => Onyx.setCollection(ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: changedReportAction} as GenericCollection));
        });

        test('one call with 10k heavy objects', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;
            await measureFunction(() => Onyx.setCollection(ONYXKEYS.COLLECTION.TEST_KEY, changedReportActions));
        });
    });

    describe('update', () => {
        beforeEach(async () => {
            await Onyx.multiSet(mockedReportActionsMap);
        });

        test('one call with one set and one merge update', async () => {
            const changedReportAction = createRandomReportAction(1);
            await measureFunction(() =>
                Onyx.update([
                    {
                        key: `${ONYXKEYS.COLLECTION.TEST_KEY}300`,
                        onyxMethod: Onyx.METHOD.SET,
                        value: changedReportAction,
                    },
                    {
                        key: `${ONYXKEYS.COLLECTION.TEST_KEY}600`,
                        onyxMethod: Onyx.METHOD.MERGE,
                        value: changedReportAction,
                    },
                ]),
            );
        });

        test('one call with 5k sets and 5k merges updates', async () => {
            const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));

            const sets = Object.entries(changedReportActions)
                .filter(([, v]) => Number(v.reportActionID) % 2 === 0)
                .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.SET, value: v}));

            const merges = Object.entries(changedReportActions)
                .filter(([, v]) => Number(v.reportActionID) % 2 !== 0)
                .map(([k, v]): OnyxUpdate => ({key: k, onyxMethod: Onyx.METHOD.MERGE, value: v}));

            const updates = alternateLists(sets, merges) as OnyxUpdate[];

            await measureFunction(() => Onyx.update(updates));
        });
    });

    describe('clear', () => {
        beforeEach(async () => {
            await Onyx.multiSet(getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY));
            await Onyx.multiSet(getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_2));
            await Onyx.multiSet(getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_3));
            await Onyx.multiSet(getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_4));
            await Onyx.multiSet(getMockedReportActions(ONYXKEYS.COLLECTION.TEST_KEY_5));
        });

        test('one call with 50k records to clean', async () => {
            await measureFunction(() => Onyx.clear());
        });
    });

    test('init', async () => {
        await measureFunction(() => undefined);
    });
});
