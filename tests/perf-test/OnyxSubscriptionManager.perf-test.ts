import {measureFunction} from 'reassure';
import {getRandomReportActions} from '../utils/collections/reportActions';
import Onyx from '../../lib';
import StorageMock from '../../lib/storage';
import {clearOnyxUtilsInternals} from '../../lib/OnyxUtils';
import onyxSubscriptionManager from '../../lib/OnyxSubscriptionManager';

const ONYXKEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;
const mockedReportActionsMap = getRandomReportActions(collectionKey);

const clearOnyxAfterEachMeasure = async () => {
    clearOnyxUtilsInternals();
    await Onyx.clear();
};

describe('OnyxSubscriptionManager', () => {
    beforeAll(async () => {
        Onyx.init({keys: ONYXKEYS});
    });

    afterEach(async () => {
        clearOnyxUtilsInternals();
        await Onyx.clear();
    });

    describe('subscribe', () => {
        test('one call subscribing to a single key', async () => {
            let unsubscribe: (() => void) | undefined;

            await measureFunction(
                () => {
                    unsubscribe = onyxSubscriptionManager.subscribe(`${collectionKey}0`, jest.fn());
                },
                {
                    beforeEach: async () => {
                        await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                    },
                    afterEach: async () => {
                        unsubscribe?.();
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });

        test('one call subscribing to a whole collection of 10k heavy objects', async () => {
            let unsubscribe: (() => void) | undefined;

            await measureFunction(
                () => {
                    unsubscribe = onyxSubscriptionManager.subscribe(collectionKey, jest.fn());
                },
                {
                    beforeEach: async () => {
                        await StorageMock.multiSet(Object.entries(mockedReportActionsMap).map(([k, v]) => [k, v]));
                    },
                    afterEach: async () => {
                        unsubscribe?.();
                        await clearOnyxAfterEachMeasure();
                    },
                },
            );
        });
    });

    describe('unsubscribe', () => {
        test('one call', async () => {
            const key = `${collectionKey}0`;
            let unsubscribe: (() => void) | undefined;

            await measureFunction(() => unsubscribe?.(), {
                beforeEach: async () => {
                    unsubscribe = onyxSubscriptionManager.subscribe(key, jest.fn());
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });
});
