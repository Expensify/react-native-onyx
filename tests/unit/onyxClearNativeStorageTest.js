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
function addStorageCallResolve(name) {
    storageCallResolveList.push(name);
}

function storageCallResolveOrder(methodName) {
    return storageCallResolveList.indexOf(methodName) + 1;
}

let storageCallQueue = [];

// Track when AsyncStorageMock.clear calls resolve.
const asyncStorageMockClear = AsyncStorageMock.clear;
AsyncStorageMock.clear = jest.fn(() => Promise.all(storageCallQueue)
    .then(() => {
        const clearPromise = asyncStorageMockClear()
            .then(addStorageCallResolve('clear'));
        storageCallQueue.push(clearPromise);
        return clearPromise;
    }));

// Track when AsyncStorageMock.setItem calls resolve.
const asyncStorageMockSetItem = AsyncStorageMock.setItem;
AsyncStorageMock.setItem = jest.fn(() => Promise.all(storageCallQueue)
    .then(() => {
        const setItemPromise = asyncStorageMockSetItem()
            .then(addStorageCallResolve('setItem'));
        storageCallQueue.push(setItemPromise);
        return setItemPromise;
    }));

describe('Set data while storage is clearing', () => {
    let connectionID;
    let Onyx;

    /** @type OnyxCache */
    let cache;

    beforeAll(() => {
        Onyx = require('../../index').default;
        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates: {
                [ONYX_KEYS.DEFAULT_KEY]: DEFAULT_VALUE,
            },
        });
    });

    // Always use a "fresh" cache instance
    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;
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
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
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
                expect(defaultValue).toBe(MERGED_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(MERGED_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.toBe(MERGED_VALUE);
            });
    });

    it('should cache the value of Onyx.set when called between the cache and storage clearing', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
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
                expect(defaultValue).toBe(SET_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(SET_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.not.toBe(SET_VALUE);
            });
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
        expect.assertions(6);
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, SET_VALUE);
        Storage.clear = jest.fn(() => AsyncStorageMock.clear());
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('setItem')).toBe(1);
                expect(storageCallResolveOrder('clear')).toBe(2);
                expect(defaultValue).toBe(DEFAULT_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // The default key state is never stored during Onyx.clear
                expect(storedValue).resolves.not.toBe(DEFAULT_VALUE);
                expect(storedValue).resolves.toBeNull();
            });
    });
});
