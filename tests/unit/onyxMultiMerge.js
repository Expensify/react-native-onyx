import Onyx from '../../index';
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

Onyx.init({
    keys: ONYX_KEYS,
    registerStorageEventListener: () => {},
    maxCachedKeysCount: 1,
    initialKeyStates: {},
});

describe('Onyx.mergeCollection()', () => {
    it('mergeCollection', () => {
        jest.useFakeTimers();

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

        jest.runAllTimers();

        return waitForPromisesToResolve()
            .then(() => {
                // Expect that our new data has merged with the existing data in storage
                expect(OnyxCache.getValue('test_1')).toEqual({
                    a: 'a', b: 'b', c: 'c', d: 'd',
                });
            });
    });
});
