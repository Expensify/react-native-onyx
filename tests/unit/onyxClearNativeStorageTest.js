import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};

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
                [ONYX_KEYS.DEFAULT_KEY]: 'default',
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
        const mergedValue = 'merged';
        expect.assertions(5);
        Storage.clear = jest.fn(() => {
            // Call merge between the cache and storage clearing
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, mergedValue);
            AsyncStorageMock.clear();
            return waitForPromisesToResolve();
        });
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('clear')).toBe(1);
                expect(storageCallResolveOrder('setItem')).toBe(2);
                expect(defaultValue).toBe(mergedValue);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(mergedValue);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.toBe(mergedValue);
            });
    });

    it('should cache the value of Onyx.set when called between the cache and storage clearing', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
        const setValue = 'set';
        expect.assertions(5);
        Storage.clear = jest.fn(() => {
            // Call set between the cache and storage clearing
            Onyx.set(ONYX_KEYS.DEFAULT_KEY, setValue);
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
                expect(defaultValue).toBe(setValue);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(setValue);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.not.toBe(setValue);
            });
    });
});
