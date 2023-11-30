import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';
import Onyx from '../../lib/Onyx';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
    REGULAR_KEY: 'regularKey',
};

// Store integers because the async storage mock adds escape characters to strings
const SET_VALUE = 2;
const MERGED_VALUE = 1;
const DEFAULT_VALUE = 0;

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
            return StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY).then((storedValue) => expect(parseInt(storedValue, 10)).toBe(DEFAULT_VALUE));
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
            return StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY).then((storedValue) => expect(parseInt(storedValue, 10)).toBe(DEFAULT_VALUE));
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
            expect(cache.getValue(ONYX_KEYS.REGULAR_KEY)).toBe(SET_VALUE);
            return StorageMock.getItem(ONYX_KEYS.REGULAR_KEY).then((storedValue) => expect(parseInt(storedValue, 10)).toBe(SET_VALUE));
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
            return StorageMock.getItem(ONYX_KEYS.DEFAULT_KEY).then((storedValue) => expect(parseInt(storedValue, 10)).toBe(SET_VALUE));
        });
    });
});
