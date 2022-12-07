import Storage from '../../__mocks__/@react-native-async-storage/async-storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
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
            callback: val => onyxValue = val,
        });
        return waitForPromisesToResolve();
    });

    afterEach(() => {
        Onyx.disconnect(connectionID);
        return Onyx.clear();
    });

    it('should persist the value of Onyx.merge when called between the cache and storage clearing', () => {
        expect.assertions(3);

        // Given that Onyx is completely clear
        // When Onyx.clear() is called
        Onyx.clear();

        // When merge is called between the cache and storage clearing, on a key with a default key state
        Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
        return waitForPromisesToResolve()
            .then(() => {
                // Then the value in Onyx, the cache, and the storage is the merged value
                expect(onyxValue).toBe(MERGED_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(MERGED_VALUE);

                // Use parseInt to convert the string value from the storage mock back to an integer
                return Storage.getItem(ONYX_KEYS.DEFAULT_KEY)
                    .then(storedValue => expect(parseInt(storedValue, 10)).toBe(MERGED_VALUE));
            });
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        expect.assertions(3);

        // Given that Onyx is completely clear
        // When set then clear is called on a key with a default key state
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                // Then the value in Onyx and the cache is the default key state
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);

                // Then the value in Storage is null
                // The default key state is never stored during Onyx.clear
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                return expect(storedValue).resolves.toBeNull();
            });
    });

    it('should replace the value of Onyx.merge with the default key state in the cache', () => {
        expect.assertions(3);

        // Given that Onyx is completely clear
        // When merge then clear is called on a key with a default key state
        Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                // Then the value in Onyx and the cache is the default key state
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // Then the value in Storage is null
                // The default key state is never stored during Onyx.clear
                return expect(storedValue).resolves.toBeNull();
            });
    });

    it('should preserve the value of any keyStatesToPreserve passed in', () => {
        expect.assertions(6);

        // Given that Onyx has a value, and we have a variable listening to that value
        let valueToKeep;
        Onyx.connect({
            key: ONYX_KEYS.REGULAR_KEY,
            initWithStoredValues: false,
            callback: val => valueToKeep = val,
        });
        Onyx.set(ONYX_KEYS.REGULAR_KEY, SET_VALUE);

        // When clear is called with a key to preserve
        Onyx.clear([ONYX_KEYS.REGULAR_KEY]);
        return waitForPromisesToResolve()
            .then(() => {
                // Then the value in Onyx and the cache for the default key is the default key state
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const defaultKeyCachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(defaultKeyCachedValue).toBe(DEFAULT_VALUE);
                const defaultKeyStoredValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // Then the value in Storage is null
                expect(defaultKeyStoredValue).resolves.toBeNull();

                // Then the value of the preserved key is also still set in both the cache and storage
                expect(valueToKeep).toBe(SET_VALUE);
                const regularKeyCachedValue = cache.getValue(ONYX_KEYS.REGULAR_KEY);
                expect(regularKeyCachedValue).toBe(SET_VALUE);
                return Storage.getItem(ONYX_KEYS.REGULAR_KEY)
                    .then(storedValue => expect(parseInt(storedValue, 10)).toBe(SET_VALUE));
            });
    });
});
