import {measureAsyncFunction, measureFunction} from 'reassure';
import type OnyxCache from '../../lib/OnyxCache';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import type GenericCollection from '../utils/GenericCollection';
import {TASK} from '../../lib/OnyxCache';

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

let cache: typeof OnyxCache;

const resetCacheBeforeEachMeasure = () => {
    // Always use a "fresh" instance
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
            await measureFunction(() => cache.addKey(mockedReportActionsKeys[0]), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('addNullishStorageKey', () => {
        test('one call adding one key', async () => {
            await measureFunction(() => cache.addNullishStorageKey(mockedReportActionsKeys[0]), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('hasNullishStorageKey', () => {
        test('one call checking one key among 10k ones', async () => {
            await measureFunction(() => cache.hasNullishStorageKey(mockedReportActionsKeys[0]), {
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
            await measureFunction(() => cache.hasCacheForKey(mockedReportActionsKeys[0]), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setAllKeys(mockedReportActionsKeys);
                },
            });
        });
    });

    describe('get', () => {
        test('one call getting one key among 10k ones', async () => {
            await measureFunction(() => cache.get(mockedReportActionsKeys[0]), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    Object.entries(mockedReportActionsMap).forEach(([k, v]) => cache.set(k, v));
                },
            });
        });
    });

    describe('set', () => {
        test('one call setting one key', async () => {
            const value = mockedReportActionsMap[mockedReportActionsKeys[0]];
            await measureFunction(() => cache.set(mockedReportActionsKeys[0], value), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('drop', () => {
        test('one call dropping one key among 10k ones', async () => {
            await measureFunction(() => cache.drop(mockedReportActionsKeys[1000]), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    Object.entries(mockedReportActionsMap).forEach(([k, v]) => cache.set(k, v));
                },
            });
        });
    });

    describe('merge', () => {
        test('one call merging 10k keys', async () => {
            const changedReportActions = Object.fromEntries(
                Object.entries(mockedReportActionsMap).map(([k, v]) => [k, createRandomReportAction(Number(v.reportActionID))] as const),
            ) as GenericCollection;

            await measureFunction(() => cache.merge(changedReportActions), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    Object.entries(mockedReportActionsMap).forEach(([k, v]) => cache.set(k, v));
                },
            });
        });
    });

    describe('hasPendingTask', () => {
        test('one call checking one task', async () => {
            await measureFunction(() => cache.hasPendingTask(`${TASK.GET}:${mockedReportActionsKeys[0]}`), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.captureTask(`${TASK.GET}:${mockedReportActionsKeys[0]}`, Promise.resolve());
                },
            });
        });
    });

    describe('getTaskPromise', () => {
        test('one call checking one task', async () => {
            await measureAsyncFunction(() => cache.getTaskPromise(`${TASK.GET}:${mockedReportActionsKeys[0]}`) as Promise<unknown>, {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.captureTask(`${TASK.GET}:${mockedReportActionsKeys[0]}`, Promise.resolve());
                },
            });
        });
    });

    describe('captureTask', () => {
        test('one call capturing one task', async () => {
            await measureAsyncFunction(() => cache.captureTask(`${TASK.GET}:${mockedReportActionsKeys[0]}`, Promise.resolve()), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('addToAccessedKeys', () => {
        test('one call adding one key', async () => {
            await measureFunction(() => cache.addToAccessedKeys(mockedReportActionsKeys[0]), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('removeLeastRecentlyUsedKeys', () => {
        test('one call removing 1000 keys', async () => {
            await measureFunction(() => cache.removeLeastRecentlyUsedKeys(), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setRecentKeysLimit(mockedReportActionsKeys.length - 1000);
                    mockedReportActionsKeys.forEach((k) => cache.addToAccessedKeys(k));
                },
            });
        });
    });

    describe('setRecentKeysLimit', () => {
        test('one call', async () => {
            await measureFunction(() => cache.setRecentKeysLimit(10000), {
                beforeEach: resetCacheBeforeEachMeasure,
            });
        });
    });

    describe('hasValueChanged', () => {
        const key = mockedReportActionsKeys[0];
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

    describe('getCollectionData', () => {
        test('one call getting collection with stable reference (10k members)', async () => {
            await measureFunction(() => cache.getCollectionData(collectionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setCollectionKeys(new Set([collectionKey]));
                    // Set all collection members
                    Object.entries(mockedReportActionsMap).forEach(([k, v]) => cache.set(k, v));
                    // First call to create stable reference
                    cache.getCollectionData(collectionKey);
                },
            });
        });

        test('one call getting collection with dirty collection (10k members)', async () => {
            await measureFunction(() => cache.getCollectionData(collectionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();
                    cache.setCollectionKeys(new Set([collectionKey]));
                    // Set all collection members
                    Object.entries(mockedReportActionsMap).forEach(([k, v]) => cache.set(k, v));
                    // Mark collection as dirty by updating a member
                    cache.set(mockedReportActionsKeys[0], createRandomReportAction(Number(mockedReportActionsMap[mockedReportActionsKeys[0]].reportActionID)));
                },
            });
        });

        test('one call getting collection among 1000 different collections', async () => {
            const targetCollectionKey = `collection_100_`;

            await measureFunction(() => cache.getCollectionData(targetCollectionKey), {
                beforeEach: async () => {
                    resetCacheBeforeEachMeasure();

                    // Create 500 collection keys
                    const collectionKeys = Array.from({length: 1000}, (_, i) => `collection_${i}_`);
                    cache.setCollectionKeys(new Set(collectionKeys));

                    // Populate each collection with mockedReportActionsMap data
                    const partOfMockedReportActionsKeys = mockedReportActionsKeys.slice(0, 20);
                    collectionKeys.forEach((colKey) => {
                        partOfMockedReportActionsKeys.forEach((originalKey) => {
                            const memberId = originalKey.replace(collectionKey, '');
                            const memberKey = `${colKey}${memberId}`;
                            cache.set(memberKey, mockedReportActionsMap[originalKey]);
                        });
                    });

                    // First call to create stable reference
                    cache.getCollectionData(targetCollectionKey);
                },
            });
        });
    });
});
