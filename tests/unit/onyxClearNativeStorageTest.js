import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};


Storage.clear = jest.fn(() => new Promise(resolve => setTimeout(resolve, 500))
    .then(() => console.log('[Onyx test] Storage is clearing now'))
    .then(() => AsyncStorageMock.clear()));

describe('Set data while storage is clearing', () => {
    let connectionID;
    let Onyx;

    /** @type OnyxCache */
    let cache;

    beforeAll(() => {
        Onyx = require('../../index').default;
        jest.useRealTimers();

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
        return Onyx.clear();
    });

    it('should store merged values when calling merge on a default key after clear', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
        console.log('[Onyx test] Clearing Onyx');
        const afterClear = Onyx.clear()
            .then(() => console.log('[Onyx test] Done clearing Onyx'));

        // Merge just after clear, on the next tick
        const afterMerge = new Promise(resolve => setTimeout(() => {
            console.log('[Onyx test] Calling Onyx.merge');
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, 'merged')
                .then(() => console.log('[Onyx test] Value stored from merge'))
                .then(resolve);
        }, 0));
        return Promise.all([afterClear, afterMerge])
            .then(() => {
                expect(defaultValue).toEqual('merged');
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toEqual('merged');
            });
    });
});
