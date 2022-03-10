import OnyxCache from '../../lib/OnyxCache';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import localforageMock from '../../__mocks__/localforage';

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

localforageMock.setInitialMockData(initialData);

describe('Onyx.mergeCollection() amd WebStorage', () => {
    let Onyx;

    beforeAll(() => {
        // Force using WebStorage provider for these tests
        jest.mock('../../lib/storage');
        Onyx = require('../../index').default;
        jest.useRealTimers();

        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates: {},
        });
    });

    afterEach(() => Onyx.clear());

    it('merges two sets of data consecutively', () => {
        const additionalDataOne = {b: 'b', c: 'c'};
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: additionalDataOne,
            test_2: additionalDataOne,
            test_3: additionalDataOne,
        });

        const additionalDataTwo = {d: 'd'};
        Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
            test_1: additionalDataTwo,
            test_2: additionalDataTwo,
            test_3: additionalDataTwo,
        });

        return waitForPromisesToResolve()
            .then(() => {
                const finalObject = {
                    a: 'a', b: 'b', c: 'c', d: 'd',
                };

                // Expect that our new data has merged with the existing data in the cache
                expect(OnyxCache.getValue('test_1')).toEqual(finalObject);
                expect(OnyxCache.getValue('test_2')).toEqual(finalObject);
                expect(OnyxCache.getValue('test_3')).toEqual(finalObject);

                // Check the storage to make sure our data has been saved
                expect(localforageMock.storageMap.test_1).toEqual(finalObject);
                expect(localforageMock.storageMap.test_2).toEqual(finalObject);
                expect(localforageMock.storageMap.test_3).toEqual(finalObject);
            });
    });

    it('setItem() and multiMerge()', () => {
        expect(localforageMock.storageMap).toEqual({});

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
        return waitForPromisesToResolve()
            .then(() => {
                const finalObject = {
                    a: 'a', b: 'b', c: 'c', f: 'f', d: 'd', e: 'e',
                };

                expect(OnyxCache.getValue('test_1')).toEqual(finalObject);
                expect(localforageMock.storageMap.test_1).toEqual(finalObject);
            });
    });
});
