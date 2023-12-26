import StorageMock from '../../lib/storage';
import Onyx from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

test('Cache eviction', () => {
    const RECORD_TO_EVICT = 'evict';
    const RECORD_TO_ADD = 'add';
    const collection = {};

    // Given an evictable key previously set in storage
    return StorageMock.setItem(`${ONYX_KEYS.COLLECTION.TEST_KEY}${RECORD_TO_EVICT}`, {test: 'evict'})
        .then(() => {
            // When we initialize Onyx and mark the set collection key as a safeEvictionKey
            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: () => {},
                safeEvictionKeys: [ONYX_KEYS.COLLECTION.TEST_KEY],
            });

            // And connect to this key
            Onyx.connect({
                key: ONYX_KEYS.COLLECTION.TEST_KEY,
                callback: (val, key) => {
                    if (!val) {
                        delete collection[key];
                    } else {
                        collection[key] = val;
                    }
                },
            });

            return waitForPromisesToResolve();
        })
        .then(() => {
            // Then it should populate our data with the key we will soon evict
            expect(collection[`${ONYX_KEYS.COLLECTION.TEST_KEY}${RECORD_TO_EVICT}`]).toStrictEqual({test: 'evict'});

            // When we set a new key we want to add and force the first attempt to fail
            const originalSetItem = StorageMock.setItem;
            const setItemMock = jest.fn(originalSetItem).mockImplementationOnce(() => new Promise((_resolve, reject) => reject()));
            StorageMock.setItem = setItemMock;

            return Onyx.set(`${ONYX_KEYS.COLLECTION.TEST_KEY}${RECORD_TO_ADD}`, {test: 'add'}).then(() => {
                // Then our collection should no longer contain the evictable key
                expect(collection[`${ONYX_KEYS.COLLECTION.TEST_KEY}${RECORD_TO_EVICT}`]).toBe(undefined);
                expect(collection[`${ONYX_KEYS.COLLECTION.TEST_KEY}${RECORD_TO_ADD}`]).toStrictEqual({test: 'add'});
            });
        });
});
