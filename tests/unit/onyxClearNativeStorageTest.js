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
    let onyxValue;

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
        onyxValue = null;
        cache = require('../../lib/OnyxCache').default;
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
                expect(storedValue).resolves.toBe(MERGED_VALUE);
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
                expect(storedValue).resolves.not.toBe(SET_VALUE);
            });
    });

    it('should replace the value of Onyx.set with the default key state in the cache', () => {
        expect.assertions(6);
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
                expect(storedValue).resolves.not.toBe(DEFAULT_VALUE);
                expect(storedValue).resolves.toBeNull();
            });
    });

    it('should replace the value of Onyx.merge with the default key state in the cache', () => {
        let onyxValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => onyxValue = val,
        });
        expect.assertions(6);
        Onyx.merge(ONYX_KEYS.DEFAULT_KEY, MERGED_VALUE);
        Storage.clear = jest.fn(() => AsyncStorageMock.clear());
        Onyx.clear();
        return waitForPromisesToResolve()
            .then(() => {
                // Onnyx.merge calls Onyx.set which sets "merged" in the cache.
                // The within Onyx.clear as the cache clears keyChanged is
                // called with the resetValue of 'defaut' so the onyxValue is
                // 'default' and same for the cache. Then keyChanged is called
                // from Onyx.set and the onyxValue is 'merged'. At that point
                // the cache is done clearing. Storage.setItem finishes setting
                // the storage to 'merged'. Then clear finishes, setting it to
                // null.
                // The end result is that the cachedValue is 'default',
                // the onyxValue is 'merged', and the storage is null.

                expect(storageCallResolveOrder('setItem')).toBe(1);
                expect(storageCallResolveOrder('clear')).toBe(2);
                expect(onyxValue).toBe(MERGED_VALUE);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(DEFAULT_VALUE);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);

                // The default key state is never stored during Onyx.clear
                expect(storedValue).resolves.not.toBe(DEFAULT_VALUE);
                expect(storedValue).resolves.toBeNull();
            });
    });
});
