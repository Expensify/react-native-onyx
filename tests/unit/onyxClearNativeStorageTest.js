import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};

jest.useFakeTimers();
Storage.clear = jest.fn(() => new Promise(resolve => setTimeout(resolve, 500))
    .then(() => AsyncStorageMock.clear()));

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
        Onyx.clear();
        jest.runAllTimers();
    });

    it('should store merged values when calling merge on a default key after clear', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });

        // Set one value so we know if the cache cleared
        // by asserting that cache.set was called once while clearing.
        Onyx.set(ONYX_KEYS.DEFAULT_KEY, 'setOneValue')
            .then(() => {
                // Set up spies to make sure merge is called
                // between the cache and storage clear.
                const clearSpy = jest.spyOn(Onyx, 'clear');
                const cacheSetSpy = jest.spyOn(cache, 'set');
                const storageClearSpy = jest.spyOn(Storage, 'clear');
                Onyx.clear();

                // Merge just after clear, on the next tick
                setTimeout(() => {
                    // Assert that Onyx.clear was called, then the cache clears,
                    // and Storage.clear has not been called before we merge.
                    expect(clearSpy).toHaveBeenCalled();
                    expect(cacheSetSpy).toHaveBeenCalledWith('default');
                    expect(storageClearSpy).not.toHaveBeenCalled();
                    Onyx.merge(ONYX_KEYS.DEFAULT_KEY, 'merged');
                }, 0);
                jest.runAllTimers();
                return waitForPromisesToResolve()
                    .then(() => {
                        expect(storageClearSpy).toHaveBeenCalled();
                        expect(defaultValue).toEqual('merged');
                        const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                        expect(cachedValue).toEqual('merged');
                    });
            });
    });
});
