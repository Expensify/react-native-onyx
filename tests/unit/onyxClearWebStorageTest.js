import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';
import Onyx from '../../lib/Onyx';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
    REGULAR_KEY: 'regularKey',
    COLLECTION: {
        TEST: 'test_',
    },
};
const SET_VALUE = 'set';
const MERGED_VALUE = 'merged';
const DEFAULT_VALUE = 'default';

describe('Set data while storage is clearing', () => {
    let connectionID;
    let onyxValue;

    /** @type OnyxCache */
    let cache;

    // Always use a "fresh" cache instance
    beforeEach(() => {
        onyxValue = null;
        cache = require('../../lib/OnyxCache').default;
        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates: {
                [ONYX_KEYS.DEFAULT_KEY]: DEFAULT_VALUE,
            },
        });
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: (val) => (onyxValue = val),
        });
        return waitForPromisesToResolve();
    });

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        expect.assertions(3);

        // Given that Onyx is completely clear
        // When set then clear is called on a key with a default key state
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
        Onyx.clear();
        return waitForPromisesToResolve().then(() => {
            // Then the value in Onyx, the cache, and Storage is the default key state
            expect(onyxValue).toBe(DEFAULT_VALUE);
            const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
            expect(cachedValue).toBe(DEFAULT_VALUE);
            const storedValue = StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY);
            return expect(storedValue).resolves.toBe(DEFAULT_VALUE);
        });
    });

    it('should replace the value of Onyx.merge with the default key state in the cache', () => {
        expect.assertions(3);

        // Given that Onyx is completely clear
        // When merge then clear is called on a key with a default key state
        Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
        Onyx.clear();
        return waitForPromisesToResolve().then(() => {
            // Then the value in Onyx, the cache, and Storage is the default key state
            expect(onyxValue).toBe(DEFAULT_VALUE);
            const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
            expect(cachedValue).toBe(DEFAULT_VALUE);
            const storedValue = StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY);
            return expect(storedValue).resolves.toBe(DEFAULT_VALUE);
        });
    });

    it('should preserve the value of any keysToPreserve passed in', () => {
        expect.assertions(3);

        // Given that Onyx has a value, and we have a variable listening to that value
        let regularKeyOnyxValue;
        Onyx.connect({
            key: ONYX_KEYS.REGULAR_KEY,
            initWithStoredValues: false,
            callback: (val) => (regularKeyOnyxValue = val),
        });
        Onyx.set(ONYX_KEYS.REGULAR_KEY, SET_VALUE).then(() => {
            // When clear is called with a key to preserve
            Onyx.clear([ONYX_KEYS.REGULAR_KEY]);
        });

        return waitForPromisesToResolve().then(() => {
            // Then the value of the preserved key is also still set in both the cache and storage
            expect(regularKeyOnyxValue).toBe(SET_VALUE);
            const regularKeyCachedValue = cache.getValue(ONYX_KEYS.REGULAR_KEY);
            expect(regularKeyCachedValue).toBe(SET_VALUE);
            const regularKeyStoredValue = StorageMock.getItem(ONYX_KEYS.REGULAR_KEY);
            return expect(regularKeyStoredValue).resolves.toBe(SET_VALUE);
        });
    });

    it('should preserve the value of any keysToPreserve over any default key states', () => {
        expect.assertions(3);

        // Given that Onyx has a value for a key with a default, and we have a variable listening to that value
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE).then(() => {
            // When clear is called with the default key to preserve
            Onyx.clear([ONYX_KEYS.DEFAULT_KEY]);
        });

        return waitForPromisesToResolve().then(() => {
            // Then the value in Onyx, the cache, and Storage is the set value
            expect(onyxValue).toBe(SET_VALUE);
            const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
            expect(cachedValue).toBe(SET_VALUE);
            const storedValue = StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY);
            return expect(storedValue).resolves.toBe(SET_VALUE);
        });
    });

    it('should only trigger the connection callback once when using wait for collection callback', () => {
        expect.assertions(4);

        // Given a mocked callback function and a collection with four items in it
        const collectionCallback = jest.fn();
        const testConnectionID = Onyx.connect({
            key: ONYX_KEYS.COLLECTION.TEST,
            waitForCollectionCallback: true,
            callback: collectionCallback,
        });
        return (
            waitForPromisesToResolve()
                .then(() =>
                    Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST, {
                        [`${ONYX_KEYS.COLLECTION.TEST}1`]: 1,
                        [`${ONYX_KEYS.COLLECTION.TEST}2`]: 2,
                        [`${ONYX_KEYS.COLLECTION.TEST}3`]: 3,
                        [`${ONYX_KEYS.COLLECTION.TEST}4`]: 4,
                    }),
                )

                // When onyx is cleared
                .then(Onyx.clear)
                .then(() => {
                    Onyx.disconnect(testConnectionID);
                })
                .then(() => {
                    // Then the collection callback should only have been called three times:
                    // 1. connect()
                    // 2. merge()
                    // 3. clear()
                    expect(collectionCallback).toHaveBeenCalledTimes(3);

                    // And it should be called with the expected parameters each time
                    expect(collectionCallback).toHaveBeenNthCalledWith(1, null, undefined);
                    expect(collectionCallback).toHaveBeenNthCalledWith(2, {
                        test_1: 1,
                        test_2: 2,
                        test_3: 3,
                        test_4: 4,
                    });
                    expect(collectionCallback).toHaveBeenLastCalledWith({});
                })
        );
    });
});
