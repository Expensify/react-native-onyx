import {measureAsyncFunction, measureFunction} from 'reassure';
import type OnyxCache from '../../lib/OnyxCache';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import {TASK} from '../../lib/OnyxCache';
import getAtIndex from '../utils/getAtIndex';

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

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
const mockedReportActionsMap = getRandomReportActions(collectionKey);
const mockedReportActionsKeys = Object.keys(mockedReportActionsMap);
const firstMockedReportActionKey = getAtIndex(mockedReportActionsKeys, 0);
const mockedReportActionKeyAt1000 = getAtIndex(mockedReportActionsKeys, 1000);

let cache: typeof OnyxCache;

const resetCacheBeforeEachMeasure = () => {
    // Always use a "fresh" instance
    jest.resetModules();

    cache = require('../../lib/OnyxCache').default;
};

describe('OnyxCache', () => {
    describe('getAllKeys', () => {
        test('one call getting 10k keys', async () => {
            await measureFunction(() => cache.getAllKeys(), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setAllKeys(mockedReportActionsKeys);
                },
            });
        });
    });

    describe('setAllKeys', () => {
        test('one call setting 10k keys', async () => {
            await measureFunction(() => cache.setAllKeys(mockedReportActionsKeys), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('addKey', () => {
        test('one call adding one key', async () => {
            await measureFunction(() => cache.addKey(firstMockedReportActionKey), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('addNullishStorageKey', () => {
        test('one call adding one key', async () => {
            await measureFunction(() => cache.addNullishStorageKey(firstMockedReportActionKey), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('hasNullishStorageKey', () => {
        test('one call checking one key among 10k ones', async () => {
            await measureFunction(() => cache.hasNullishStorageKey(firstMockedReportActionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setAllKeys(mockedReportActionsKeys);
                },
            });
        });
    });

    describe('clearNullishStorageKeys', () => {
        test('one call clearing 10k keys', async () => {
            await measureFunction(() => cache.clearNullishStorageKeys(), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setAllKeys(mockedReportActionsKeys);
                },
            });
        });
    });

    describe('hasCacheForKey', () => {
        test('one call checking one key among 10k ones', async () => {
            await measureFunction(() => cache.hasCacheForKey(firstMockedReportActionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setAllKeys(mockedReportActionsKeys);
                },
            });
        });
    });

    describe('get', () => {
        test('one call getting one key among 10k ones', async () => {
            await measureFunction(() => cache.get(firstMockedReportActionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    for (const [k, v] of Object.entries(mockedReportActionsMap)) cache.set(k, v);
                },
            });
        });
    });

    describe('set', () => {
        test('one call setting one key', async () => {
            const value = mockedReportActionsMap[firstMockedReportActionKey];
            await measureFunction(() => cache.set(firstMockedReportActionKey, value), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('drop', () => {
        test('one call dropping one key among 10k ones', async () => {
            await measureFunction(() => cache.drop(mockedReportActionKeyAt1000), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    for (const [k, v] of Object.entries(mockedReportActionsMap)) cache.set(k, v);
                },
            });
        });
    });

    describe('merge', () => {
        test('one call merging 10k keys', async () => {
            const changedReportActions = Object.fromEntries(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const));

            await measureFunction(() => cache.merge(changedReportActions), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    for (const [k, v] of Object.entries(mockedReportActionsMap)) cache.set(k, v);
                },
            });
        });
    });

    describe('hasPendingTask', () => {
        test('one call checking one task', async () => {
            await measureFunction(() => cache.hasPendingTask(`${TASK.GET}:${firstMockedReportActionKey}`), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.captureTask(`${TASK.GET}:${firstMockedReportActionKey}`, Promise.resolve());
                },
            });
        });
    });

    describe('getTaskPromise', () => {
        test('one call checking one task', async () => {
            await measureAsyncFunction(() => cache.getTaskPromise(`${TASK.GET}:${firstMockedReportActionKey}`)!, {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.captureTask(`${TASK.GET}:${firstMockedReportActionKey}`, Promise.resolve());
                },
            });
        });
    });

    describe('captureTask', () => {
        test('one call capturing one task', async () => {
            await measureAsyncFunction(() => cache.captureTask(`${TASK.GET}:${firstMockedReportActionKey}`, Promise.resolve()), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('hasValueChanged', () => {
        const key = firstMockedReportActionKey;
        const reportAction = mockedReportActionsMap[key];
        const changedReportAction = createRandomReportAction(Number(reportAction.reportActionID));

        test('one call checking one key', async () => {
            await measureFunction(() => cache.hasValueChanged(key, changedReportAction), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.set(key, reportAction);
                },
            });
        });
    });
});
