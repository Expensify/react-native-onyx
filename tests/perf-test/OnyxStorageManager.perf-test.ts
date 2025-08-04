import {measureAsyncFunction, measureFunction} from 'reassure';
import Onyx from '../../lib';
import storageManager from '../../lib/OnyxStorageManager';
import {getRandomReportActions} from '../utils/collections/reportActions';
import type {OnyxKey} from '../../lib/types';

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

const collectionKey = ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY;
const mockedReportActionsMap = getRandomReportActions(collectionKey);
const mockedReportActionsKeys = Object.keys(mockedReportActionsMap);

const resetStorageManagerAfterEachMeasure = async () => {
    storageManager.config.enabled = false;
    storageManager.setEvictableKeys([]);
    await Onyx.clear();
};

describe('OnyxStorageManager', () => {
    beforeAll(async () => {
        await Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
        });
    });

    describe('initialize', () => {
        test('one call', async () => {
            await measureAsyncFunction(
                async () => {
                    await storageManager.initialize();
                },
                {
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });

        test('one call with 1000 existing keys', async () => {
            await measureAsyncFunction(
                async () => {
                    await storageManager.initialize({
                        evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                    });
                },
                {
                    beforeEach: async () => {
                        const promises = [];
                        for (let i = 0; i < 1000; i++) {
                            promises.push(Onyx.set(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`, {id: i, data: `test-data-${i}`}));
                        }
                        await Promise.all(promises);
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });

    describe('trackKeySet', () => {
        test('one call', async () => {
            await measureFunction(
                () => {
                    storageManager.trackKeySet(mockedReportActionsKeys[0]);
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });

        test('tracking 1000 key sets', async () => {
            await measureFunction(
                () => {
                    for (let i = 0; i < 1000; i++) {
                        storageManager.trackKeySet(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`);
                    }
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });

    describe('trackKeyRemoval', () => {
        test('one call', async () => {
            await measureFunction(
                () => {
                    storageManager.trackKeyRemoval(mockedReportActionsKeys[0]);
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });
                        storageManager.trackKeySet(mockedReportActionsKeys[0]);
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });

        test('tracking 1000 key removals', async () => {
            await measureFunction(
                () => {
                    for (let i = 0; i < 1000; i++) {
                        storageManager.trackKeyRemoval(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`);
                    }
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });
                        for (let i = 0; i < 1000; i++) {
                            storageManager.trackKeySet(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`);
                        }
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });

    describe('setEvictableKeys', () => {
        test('one call with 100 patterns', async () => {
            const evictableKeys: OnyxKey[] = [];
            for (let i = 0; i < 100; i++) {
                evictableKeys.push(`pattern_${i}_`);
            }

            await measureFunction(
                () => {
                    storageManager.setEvictableKeys(evictableKeys);
                },
                {
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });

    describe('shouldPerformCleanup', () => {
        test('one call with 1000 tracked keys', async () => {
            await measureFunction(
                () => {
                    return storageManager.shouldPerformCleanup();
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            enabled: true,
                            maxIdleDays: 7,
                            maxAgeDays: 30,
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });
                        for (let i = 0; i < 1000; i++) {
                            storageManager.trackKeySet(`${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`);
                        }
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });

    describe('performCleanup', () => {
        test('cleanup with 1000 expired keys', async () => {
            await measureAsyncFunction(
                async () => {
                    return storageManager.performCleanup();
                },
                {
                    beforeEach: async () => {
                        await storageManager.initialize({
                            enabled: true,
                            maxIdleDays: 0,
                            maxAgeDays: 0,
                            evictableKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
                        });

                        const promises = [];
                        for (let i = 0; i < 1000; i++) {
                            const key = `${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`;
                            promises.push(Onyx.set(key, {id: i, data: `expired-data-${i}`}));
                        }
                        await Promise.all(promises);

                        for (let i = 0; i < 1000; i++) {
                            const key = `${ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY}${i}`;
                            storageManager.trackKeySet(key);
                        }
                    },
                    afterEach: resetStorageManagerAfterEachMeasure,
                },
            );
        });
    });
});
