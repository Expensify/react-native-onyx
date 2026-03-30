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

    test('waitForCollectionCallback=true should deliver full collection from storage', async () => {
        const mockCallback = jest.fn();

        // A component connects to the collection (starts async hydration via multiGet).
        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            waitForCollectionCallback: true,
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

    test('waitForCollectionCallback=false should deliver all shallow-equal collection members when set() races with hydration', async () => {
        // Clear existing storage and set up shallow-equal values for all members
        await StorageMock.clear();
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {status: 'active'});
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`, {status: 'active'});
        await StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`, {status: 'active'});
        // Re-init so Onyx picks up the new storage keys
        Onyx.init({keys: ONYX_KEYS});

        const mockCallback = jest.fn();

        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            waitForCollectionCallback: false,
            callback: mockCallback,
        });

        // set() with the same shallow-equal value — this fires keyChanged synchronously,
        // populating lastConnectionCallbackData before the hydration multiGet resolves.
        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {status: 'active'});

        await waitForPromisesToResolve();

        const deliveredKeys = new Set<string>();
        for (const call of mockCallback.mock.calls) {
            const [, key] = call;
            if (key) {
                deliveredKeys.add(key);
            }
        }

        // ALL three members must be delivered, even though their values are shallow-equal.
        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`);
        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`);
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
            waitForCollectionCallback: true,
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

    test('waitForCollectionCallback=false should deliver all collection members from storage', async () => {
        const mockCallback = jest.fn();

        // A component connects to the collection (callback fires per key, not batched).
        Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST_KEY,
            waitForCollectionCallback: false,
            callback: mockCallback,
        });

        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`, {id: 1, title: 'Updated Test One'});

        await waitForPromisesToResolve();

        // With waitForCollectionCallback=false, the callback fires per key individually.
        // Collect all keys that were delivered across all calls.
        const deliveredKeys = new Set<string>();
        for (const call of mockCallback.mock.calls) {
            const [, key] = call;
            if (key) {
                deliveredKeys.add(key);
            }
        }

        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}2`);
        expect(deliveredKeys).toContain(`${ONYX_KEYS.COLLECTION.TEST_KEY}3`);

        // Verify the updated value is present (not stale) by finding the last call for key 1
        const key1Calls = mockCallback.mock.calls.filter((call) => call[1] === `${ONYX_KEYS.COLLECTION.TEST_KEY}1`);
        const lastKey1Value = key1Calls[key1Calls.length - 1][0];
        expect(lastKey1Value).toEqual({id: 1, title: 'Updated Test One'});
    });
});
