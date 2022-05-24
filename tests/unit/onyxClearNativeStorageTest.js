import AsyncStorageMock from '../../__mocks__/@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import Onyx from '../../lib/Onyx';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};
const SET_VALUE = 'set';
const MERGED_VALUE = 'merged';
const DEFAULT_VALUE = 'default';

let storageCallResolveList = [];

/**
 * Get the order in which the storage method call resolved so we can assert that
 * updates to storage are made in the expected order.
 * @param {String} methodName The name of the storage method
 * @returns {Number}
 */
function getStorageCallResolveOrder(methodName) {
    return storageCallResolveList.indexOf(methodName) + 1;
}

let storageCallQueue = [];

// Track when AsyncStorageMock.clear calls resolve.
const asyncStorageMockClear = AsyncStorageMock.clear;
AsyncStorageMock.clear = jest.fn(() => Promise.all(storageCallQueue)
    .then(() => {
        const clearPromise = asyncStorageMockClear()
            .then(storageCallResolveList.push('clear'));
        storageCallQueue.push(clearPromise);
        return clearPromise;
    }));

// Track when AsyncStorageMock.setItem calls resolve.
const asyncStorageMockSetItem = AsyncStorageMock.setItem;
AsyncStorageMock.setItem = jest.fn((key, value) => Promise.all(storageCallQueue)
    .then(() => {
        const setItemPromise = asyncStorageMockSetItem(key, value)
            .then(storageCallResolveList.push('setItem'));
        storageCallQueue.push(setItemPromise);
        return setItemPromise;
    }));

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
        Storage.clear.mockReset();
        return Onyx.clear()
            .then(() => {
                storageCallResolveList = [];
                storageCallQueue = [];
            });
    });

    it('should persist the value of Onyx.merge when called between the cache and storage clearing', () => {
        expect.assertions(5);

        // GIVEN that Onyx is completely clear
        // WHEN Onyx.clear() is called
        Storage.clear = jest.fn(() => {
            // WHEN merge is called between the cache and storage clearing, on a key with a default key state
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
            AsyncStorageMock.clear();
            return waitForPromisesToResolve();
        });
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                // THEN the storage finishes clearing before Storage.setItem finishes for the merged value
                expect(getStorageCallResolveOrder('clear')).toBe(1);
                expect(getStorageCallResolveOrder('setItem')).toBe(2);

                // THEN the value in Onyx, the cache, and the storage are the merged value
                expect(onyxValue).toBe(MERGED_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(MERGED_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                return expect(storedValue).resolves.toBe(MERGED_VALUE);
            });
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        expect.assertions(5);
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
        Storage.clear = jest.fn(() => AsyncStorageMock.clear());
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(getStorageCallResolveOrder('setItem')).toBe(1);
                expect(getStorageCallResolveOrder('clear')).toBe(2);
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // The default key state is never stored during Onyx.clear
                return expect(storedValue).resolves.toBeNull();
            });
    });

    it('should replace the value of Onyx.merge with the default key state in the cache', () => {
        expect.assertions(5);
        Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
        Storage.clear = jest.fn(() => AsyncStorageMock.clear());
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(getStorageCallResolveOrder('setItem')).toBe(1);
                expect(getStorageCallResolveOrder('clear')).toBe(2);
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // The default key state is never stored during Onyx.clear
                return expect(storedValue).resolves.toBeNull();
            });
    });
});
