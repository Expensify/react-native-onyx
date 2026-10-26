import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';
import Onyx from '../../lib/Onyx';
import type OnyxCache from '../../lib/OnyxCache';
import type GenericCollection from '../utils/GenericCollection';
import type {Connection} from '../../lib/Onyx';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
    REGULAR_KEY: 'regularKey',
    COLLECTION: {
        TEST: 'test_',
    },
};
const OLD_VALUE = 'old';
const NEW_VALUE = 'new';
const DEFAULT_VALUE = 'default';

describe('Write data while Onyx.clear is in progress', () => {
    let connections: Connection[] = [];
    let defaultKeyValue: unknown;
    let regularKeyValue: unknown;
    let collectionValue: GenericCollection | undefined;
    let cache: typeof OnyxCache;
    let finishRemoveItems: () => void;

    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;
        Onyx.init({
            keys: ONYX_KEYS,
            initialKeyStates: {
                [ONYX_KEYS.DEFAULT_KEY]: DEFAULT_VALUE,
            },
        });
        connections = [
            Onyx.connect({key: ONYX_KEYS.DEFAULT_KEY, callback: (value) => (defaultKeyValue = value)}),
            Onyx.connect({key: ONYX_KEYS.REGULAR_KEY, callback: (value) => (regularKeyValue = value)}),
            Onyx.connect({key: ONYX_KEYS.COLLECTION.TEST, callback: (value) => (collectionValue = value as GenericCollection)}),
        ];
        return waitForPromisesToResolve();
    });

    afterEach(() => {
        for (const connection of connections) {
            connection.unsubscribe();
        }
        return Onyx.clear();
    });

    // Holds Onyx.clear() in its storage step, so the test can write while the clear is still running.
    function holdNextRemoveItems() {
        const removeItemsMock = StorageMock.removeItems as jest.Mock;
        const originalImplementation = removeItemsMock.getMockImplementation();
        removeItemsMock.mockImplementationOnce(
            (keys: string[]) =>
                new Promise((resolve) => {
                    finishRemoveItems = () => resolve(originalImplementation?.(keys));
                }),
        );
    }

    it('should keep values written to keys after the clear reset them', async () => {
        // Given keys that hold values from a previous session
        await Onyx.multiSet({
            [ONYX_KEYS.DEFAULT_KEY]: OLD_VALUE,
            [ONYX_KEYS.REGULAR_KEY]: OLD_VALUE,
            [`${ONYX_KEYS.COLLECTION.TEST}1`]: OLD_VALUE,
        });

        // When a clear starts and new values are written before its storage step finishes, like a new sign-in
        // saving its session while the previous sign-out is still wiping storage
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, NEW_VALUE);
        Onyx.merge(ONYX_KEYS.REGULAR_KEY, NEW_VALUE);
        Onyx.set(`${ONYX_KEYS.COLLECTION.TEST}1`, NEW_VALUE);
        await waitForPromisesToResolve();
        finishRemoveItems();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the clear does not overwrite the new values in subscribers, the cache or storage
        expect(defaultKeyValue).toBe(NEW_VALUE);
        expect(regularKeyValue).toBe(NEW_VALUE);
        expect(collectionValue).toEqual({[`${ONYX_KEYS.COLLECTION.TEST}1`]: NEW_VALUE});
        expect(cache.get(ONYX_KEYS.DEFAULT_KEY)).toBe(NEW_VALUE);
        expect(cache.get(ONYX_KEYS.REGULAR_KEY)).toBe(NEW_VALUE);
        expect(cache.get(`${ONYX_KEYS.COLLECTION.TEST}1`)).toBe(NEW_VALUE);
        await expect(StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY)).resolves.toBe(NEW_VALUE);
        await expect(StorageMock.getItem(ONYX_KEYS.REGULAR_KEY)).resolves.toBe(NEW_VALUE);
        await expect(StorageMock.getItem(`${ONYX_KEYS.COLLECTION.TEST}1`)).resolves.toBe(NEW_VALUE);
    });

    it('should still reset keys that were not written during the clear', async () => {
        // Given keys that hold values from a previous session
        await Onyx.multiSet({
            [ONYX_KEYS.DEFAULT_KEY]: OLD_VALUE,
            [ONYX_KEYS.REGULAR_KEY]: OLD_VALUE,
        });

        // When a clear runs and only one key gets a new value while it is in progress
        holdNextRemoveItems();
        const clearPromise = Onyx.clear();
        await waitForPromisesToResolve();
        Onyx.set(ONYX_KEYS.REGULAR_KEY, NEW_VALUE);
        await waitForPromisesToResolve();
        finishRemoveItems();
        await clearPromise;
        await waitForPromisesToResolve();

        // Then the written key keeps its new value and the other key is reset to its default
        expect(regularKeyValue).toBe(NEW_VALUE);
        expect(defaultKeyValue).toBe(DEFAULT_VALUE);
        expect(cache.get(ONYX_KEYS.DEFAULT_KEY)).toBe(DEFAULT_VALUE);
        await expect(StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY)).resolves.toBe(DEFAULT_VALUE);
    });
});
