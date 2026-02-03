import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        RAM_ONLY_COLLECTION: 'ramOnlyCollection_',
    },
    RAM_ONLY_TEST_KEY: 'ramOnlyKey',
};

function initOnyx() {
    Onyx.init({
        keys: ONYX_KEYS,
        ramOnlyKeys: [ONYX_KEYS.RAM_ONLY_TEST_KEY, ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION],
    });

    // Onyx init introduces some side effects e.g. calls the getAllKeys
    // We're clearing mocks to have a fresh calls history
    return waitForPromisesToResolve().then(() => jest.clearAllMocks());
}

describe('pre-existing keys', () => {
    it('should be removed from storage when migrated to RAM-only', async () => {
        // Simulate a scenario where keys are migrated from non RAM-only to RAM-only
        // Save key values to storage
        await StorageMock.multiSet([
            [`${ONYX_KEYS.RAM_ONLY_TEST_KEY}`, 'test value 1'],
            [`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}entry1`, 'test value 2'],
        ]);

        // Make sure values are stored
        expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toEqual('test value 1');
        expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}entry1`)).toEqual('test value 2');

        // Initialize Onyx with the ramOnlyKeys property
        await initOnyx();

        // Verify if the newly migrated RAM-only keys were removed from storage
        expect(await StorageMock.getItem(ONYX_KEYS.RAM_ONLY_TEST_KEY)).toBeNull();
        expect(await StorageMock.getItem(`${ONYX_KEYS.COLLECTION.RAM_ONLY_COLLECTION}entry1`)).toBeNull();
    });
});
