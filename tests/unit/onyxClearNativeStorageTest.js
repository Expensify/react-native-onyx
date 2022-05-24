import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};
const SET_VALUE = 'set';
const MERGED_VALUE = 'merged';
const DEFAULT_VALUE = 'default';

let storageCallResolveList = [];
function storageCallResolveOrder(methodName) {
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
    let Onyx;
    let onyxValue;

    /** @type OnyxCache */
    let cache;

    beforeAll(() => {
        Onyx = require('../../index').default;
    });

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
        Storage.clear = jest.fn(() => {
            // Call merge between the cache and storage clearing
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
            AsyncStorageMock.clear();
            return waitForPromisesToResolve();
        });
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('clear')).toBe(1);
                expect(storageCallResolveOrder('setItem')).toBe(2);
                expect(onyxValue).toBe(MERGED_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(MERGED_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                return expect(storedValue).resolves.toBe(MERGED_VALUE);
            });
    });

    it('should cache the value of Onyx.set when called between the cache and storage clearing', () => {
        expect.assertions(5);
        Storage.clear = jest.fn(() => {
            // Call set between the cache and storage clearing
            Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
            AsyncStorageMock.clear();
            return waitForPromisesToResolve();
        });
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                // Onyx.set is faster than merge.
                // AsyncStorage.setItem resolves before AsyncStorage.clear
                expect(storageCallResolveOrder('setItem')).toBe(1);
                expect(storageCallResolveOrder('clear')).toBe(2);
                expect(onyxValue).toBe(SET_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(SET_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                return expect(storedValue).resolves.toBe(SET_VALUE);
            });
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        expect.assertions(5);
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
        Storage.clear = jest.fn(() => AsyncStorageMock.clear());
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('setItem')).toBe(1);
                expect(storageCallResolveOrder('clear')).toBe(2);
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
                expect(storageCallResolveOrder('setItem')).toBe(1);
                expect(storageCallResolveOrder('clear')).toBe(2);
                expect(onyxValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // The default key state is never stored during Onyx.clear
                return expect(storedValue).resolves.toBeNull();
            });
    });
});
