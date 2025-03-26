import {measureAsyncFunction, measureFunction} from 'reassure';
import Onyx from '../../lib';
import type {Connection} from '../../lib/OnyxConnectionManager';
import connectionManager from '../../lib/OnyxConnectionManager';
import createDeferredTask from '../../lib/createDeferredTask';
import {createCollection} from '../utils/collections/createCollection';
import createRandomReportAction from '../utils/collections/reportActions';

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

const getMockedReportActions = (collection = collectionKey, length = 10000) =>
    createCollection<Record<string, unknown>>(
        (item) => `${collection}${item.reportActionID}`,
        (index) => createRandomReportAction(index),
        length,
    );

const mockedReportActionsMap = getMockedReportActions();
const mockedReportActionsKeys = Object.keys(mockedReportActionsMap);

// We need access to some internal properties of `connectionManager` during the tests but they are private,
// so this workaround allows us to have access to them.
// eslint-disable-next-line dot-notation
const generateConnectionID = connectionManager['generateConnectionID'];
// eslint-disable-next-line dot-notation
const fireCallbacks = connectionManager['fireCallbacks'];

const resetConectionManagerAfterEachMeasure = () => {
    connectionManager.disconnectAll();
};

const clearOnyxAfterEachMeasure = async () => {
    await Onyx.clear();
};

describe('OnyxConnectionManager', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            safeEvictionKeys: [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY],
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    describe('generateConnectionID', () => {
        test('one call', async () => {
            await measureFunction(() => generateConnectionID({key: mockedReportActionsKeys[0]}), {
                afterEach: async () => {
                    resetConectionManagerAfterEachMeasure();
                },
            });
        });
    });

    describe('fireCallbacks', () => {
        test('one call firing 10k callbacks', async () => {
            let connectionID = '';

            await measureFunction(() => fireCallbacks(connectionID), {
                beforeEach: async () => {
                    connectionID = connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()}).id;
                    for (let i = 0; i < 9999; i++) {
                        connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()});
                    }
                },
                afterEach: async () => {
                    resetConectionManagerAfterEachMeasure();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('connect', () => {
        test('one call', async () => {
            await measureAsyncFunction(
                async () => {
                    const callback = createDeferredTask();
                    connectionManager.connect({
                        key: mockedReportActionsKeys[0],
                        callback: () => {
                            callback.resolve?.();
                        },
                    });
                    return callback.promise;
                },
                {
                    afterEach: async () => {
                        resetConectionManagerAfterEachMeasure();
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('disconnect', () => {
        test('one call', async () => {
            let connection: Connection | undefined;

            await measureFunction(
                () => {
                    connectionManager.disconnect(connection as Connection);
                },
                {
                    beforeEach: async () => {
                        connection = connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()});
                    },
                    afterEach: async () => {
                        resetConectionManagerAfterEachMeasure();
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('disconnectAll', () => {
        test('one call disconnecting 10k connections', async () => {
            await measureFunction(() => connectionManager.disconnectAll(), {
                beforeEach: async () => {
                    for (let i = 0; i < 10000; i++) {
                        connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()});
                    }
                },
                afterEach: async () => {
                    resetConectionManagerAfterEachMeasure();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('refreshSessionID', () => {
        test('one call', async () => {
            await measureFunction(() => connectionManager.refreshSessionID(), {
                afterEach: async () => {
                    resetConectionManagerAfterEachMeasure();
                },
            });
        });
    });

    describe('addToEvictionBlockList', () => {
        let connection: Connection | undefined;

        test('one call', async () => {
            await measureFunction(() => connectionManager.addToEvictionBlockList(connection as Connection), {
                beforeEach: async () => {
                    connection = connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()});
                },
                afterEach: async () => {
                    connectionManager.removeFromEvictionBlockList(connection as Connection);
                    resetConectionManagerAfterEachMeasure();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });

    describe('removeFromEvictionBlockList', () => {
        let connection: Connection | undefined;

        test('one call', async () => {
            await measureFunction(() => connectionManager.removeFromEvictionBlockList(connection as Connection), {
                beforeEach: async () => {
                    connection = connectionManager.connect({key: mockedReportActionsKeys[0], callback: jest.fn()});
                    connectionManager.addToEvictionBlockList(connection as Connection);
                },
                afterEach: async () => {
                    resetConectionManagerAfterEachMeasure();
                    await clearOnyxAfterEachMeasure();
                },
            });
        });
    });
});
