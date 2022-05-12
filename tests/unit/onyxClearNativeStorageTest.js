import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};

jest.useFakeTimers();

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
        Storage.clear = jest.fn(() => {
            // Merge after the cache has cleared but before the storage actually clears
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, 'merged');
            return new Promise(resolve => setTimeout(resolve, 500))
                .then(() => AsyncStorageMock.clear());
        });
        Onyx.clear();
        jest.runAllTimers();
        waitForPromisesToResolve()
            .then(() => {
                expect(defaultValue).toEqual('merged');
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toEqual('merged');
                Storage.clear.mockRestore();
            });
    });
});
