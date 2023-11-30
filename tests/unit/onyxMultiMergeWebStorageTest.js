import OnyxCache from '../../lib/OnyxCache';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import StorageMock from '../../lib/storage';

const ONYX_KEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const initialTestObject = {a: 'a'};
const initialData = {
    test_1: initialTestObject,
    test_2: initialTestObject,
    test_3: initialTestObject,
};

describe('Onyx.mergeCollection() and WebStorage', () => {
    let Onyx;

    beforeAll(() => {
        Onyx = require('../../lib').default;
        jest.useRealTimers();

        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates: {},
        });
    });

    afterEach(() => Onyx.clear());

    it('merges two sets of data consecutively', () => {
        StorageMock.setInitialMockData(initialData);

        // Given initial data in storage
        expect(StorageMock.getStorageMap().test_1).toEqual(initialTestObject);
        expect(StorageMock.getStorageMap().test_2).toEqual(initialTestObject);
        expect(StorageMock.getStorageMap().test_3).toEqual(initialTestObject);

        // And an empty cache values for the collection keys
        expect(OnyxCache.getValue('test_1')).not.toBeDefined();
        expect(OnyxCache.getValue('test_2')).not.toBeDefined();
        expect(OnyxCache.getValue('test_3')).not.toBeDefined();

        // When we merge additional data
        const additionalDataOne = {b: 'b', c: 'c', e: [1, 2]};
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: additionalDataOne,
            test_2: additionalDataOne,
            test_3: additionalDataOne,
        });

        // And call again consecutively with different data
        const additionalDataTwo = {d: 'd', e: [2]};
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: additionalDataTwo,
            test_2: additionalDataTwo,
            test_3: additionalDataTwo,
        });

        return waitForPromisesToResolve().then(() => {
            const finalObject = {
                a: 'a',
                b: 'b',
                c: 'c',
                d: 'd',
                e: [2],
            };

            // Then our new data should merge with the existing data in the cache
            expect(OnyxCache.getValue('test_1')).toEqual(finalObject);
            expect(OnyxCache.getValue('test_2')).toEqual(finalObject);
            expect(OnyxCache.getValue('test_3')).toEqual(finalObject);

            // And the storage should reflect the same state
            expect(StorageMock.getStorageMap().test_1).toEqual(finalObject);
            expect(StorageMock.getStorageMap().test_2).toEqual(finalObject);
            expect(StorageMock.getStorageMap().test_3).toEqual(finalObject);
        });
    });

    it('cache updates correctly when accessed again if keys are removed or evicted', () => {
        // Given empty storage
        expect(StorageMock.getStorageMap().test_1).toBeFalsy();
        expect(StorageMock.getStorageMap().test_2).toBeFalsy();
        expect(StorageMock.getStorageMap().test_3).toBeFalsy();

        // And an empty cache values for the collection keys
        expect(OnyxCache.getValue('test_1')).toBeFalsy();
        expect(OnyxCache.getValue('test_2')).toBeFalsy();
        expect(OnyxCache.getValue('test_3')).toBeFalsy();

        // When we merge additional data and wait for the change
        const data = {a: 'a', b: 'b'};
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: data,
            test_2: data,
            test_3: data,
        });

        return waitForPromisesToResolve()
            .then(() => {
                // Then the cache and storage should match
                expect(OnyxCache.getValue('test_1')).toEqual(data);
                expect(OnyxCache.getValue('test_2')).toEqual(data);
                expect(OnyxCache.getValue('test_3')).toEqual(data);
                expect(StorageMock.getStorageMap().test_1).toEqual(data);
                expect(StorageMock.getStorageMap().test_2).toEqual(data);
                expect(StorageMock.getStorageMap().test_3).toEqual(data);

                // When we drop all the cache keys (but do not modify the underlying storage) and merge another object
                OnyxCache.drop('test_1');
                OnyxCache.drop('test_2');
                OnyxCache.drop('test_3');

                const additionalData = {c: 'c'};
                Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
                    test_1: additionalData,
                    test_2: additionalData,
                    test_3: additionalData,
                });

                return waitForPromisesToResolve();
            })
            .then(() => {
                const finalObject = {
                    a: 'a',
                    b: 'b',
                    c: 'c',
                };

                // Then our new data should merge with the existing data in the cache
                expect(OnyxCache.getValue('test_1')).toEqual(finalObject);
                expect(OnyxCache.getValue('test_2')).toEqual(finalObject);
                expect(OnyxCache.getValue('test_3')).toEqual(finalObject);

                // And the storage should reflect the same state
                expect(StorageMock.getStorageMap().test_1).toEqual(finalObject);
                expect(StorageMock.getStorageMap().test_2).toEqual(finalObject);
                expect(StorageMock.getStorageMap().test_3).toEqual(finalObject);
            });
    });

    it('setItem() and multiMerge()', () => {
        // Onyx should be empty after clear() is called
        expect(StorageMock.getStorageMap()).toEqual({});

        // Given no previous data and several calls to setItem and call to mergeCollection to update a given key

        // 1st call
        Onyx.set('test_1', {a: 'a'});

        // These merges will all queue together
        Onyx.merge('test_1', {b: 'b'});
        Onyx.merge('test_1', {c: 'c'});

        // 2nd call
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: {d: 'd', e: 'e'},
        });

        // Last call
        Onyx.merge('test_1', {f: 'f'});
        return waitForPromisesToResolve().then(() => {
            const finalObject = {
                a: 'a',
                b: 'b',
                c: 'c',
                d: 'd',
                e: 'e',
                f: 'f',
            };

            expect(OnyxCache.getValue('test_1')).toEqual(finalObject);
            expect(StorageMock.getStorageMap().test_1).toEqual(finalObject);
        });
    });
});
