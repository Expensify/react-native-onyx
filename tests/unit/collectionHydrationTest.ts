import StorageMock from '../../lib/storage';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
    SINGLE_KEY: 'single',
};

describe('Collection hydration with connect() followed by immediate set()', () => {
    beforeEach(async () => {
        // ===== Session 1 =====
        // Data is written to persistent storage (simulates a previous app session).
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {id: 1, title: 'Test One'});
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, {id: 2, title: 'Test Two'});
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`, {id: 3, title: 'Test Three'});
        await StorageMock.setItem(ONYX_KEYS.SINGLE_KEY, {title: 'old'});

        // ===== Session 2 =====
        // App restarts. Onyx.init() calls getAllKeys() which populates storageKeys
        // with all 3 keys, but their values are NOT read into cache yet.
        Onyx.init({keys: ONYX_KEYS});
    });

    afterEach(() => Onyx.clear());

    test('collection connect should deliver full collection from storage', async () => {
        const mockCallback = jest.fn();

        // A component connects to the collection (starts async hydration via multiGet).
        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            callback: mockCallback,
        });

        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {id: 1, title: 'Updated Test One'});

        await waitForPromisesToResolve();

        // The subscriber should eventually receive ALL collection members.
        // The async hydration reads test_2 and test_3 from storage.
        const lastCall = mockCallback.mock.calls[mockCallback.mock.calls.length - 1][0];
        expect(lastCall).toHaveProperty(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
        expect(lastCall).toHaveProperty(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`);
        expect(lastCall).toHaveProperty(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`);

        // Verify the updated value is present (not stale)
        expect(lastCall[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]).toEqual({id: 1, title: 'Updated Test One'});
    });

    test('single key: set() with non-shallow-equal value should not be overwritten by stale hydration', async () => {
        const mockCallback = jest.fn();

        Onyx.connect({
            key: ONYX_KEYS.SINGLE_KEY,
            callback: mockCallback,
        });

        // Immediately update the key with a non-shallow-equal
        Onyx.set(ONYX_KEYS.SINGLE_KEY, {title: 'new'});

        await waitForPromisesToResolve();

        // The LAST value delivered to the subscriber must be the fresh one, not the stale storage value
        const lastValue = mockCallback.mock.calls[mockCallback.mock.calls.length - 1][0];
        expect(lastValue).toEqual({title: 'new'});
    });

    test('collection key: set() with non-shallow-equal value should not be regressed by hydration multiGet', async () => {
        const mockCallback = jest.fn();

        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            callback: mockCallback,
        });

        // Update key 1 with a non-shallow-equal value while hydration multiGet is in-flight
        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {id: 1, title: 'Freshly Updated'});

        await waitForPromisesToResolve();

        const lastCall = mockCallback.mock.calls[mockCallback.mock.calls.length - 1][0];

        // The final collection snapshot must have the fresh value, not the stale storage one
        expect(lastCall[`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]).toEqual({id: 1, title: 'Freshly Updated'});
        // Other members should still be present from storage
        expect(lastCall[`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]).toEqual({id: 2, title: 'Test Two'});
        expect(lastCall[`${ONYX_KEYS.COLLECTION.TEST_KEY}3`]).toEqual({id: 3, title: 'Test Three'});
    });
});
