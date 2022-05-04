import Storage from '../../lib/storage';
import localforageMock from '../../__mocks__/localforage';


const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};

describe('Set data while storage is clearing', () => {
    let Onyx;
    let connectionID;

    /** @type OnyxCache */
    let cache;

    beforeAll(() => {
        // Force using WebStorage provider for these tests
        jest.mock('../../lib/storage');
        localforageMock.setDelayForClear(20);
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
        jest.resetModules();
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
        const afterClear = Onyx.clear();
        const afterMerge = Onyx.merge(ONYX_KEYS.DEFAULT_KEY, 'merged');
        return Promise.all([afterClear, afterMerge])
            .then(() => {
                expect(defaultValue).toEqual('merged');
                return Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
            })
            .then((storedValue) => {
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toEqual(storedValue);
            });
    });
});
