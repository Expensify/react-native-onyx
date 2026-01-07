import Onyx from '../../dist/Onyx';
import ONYX_KEYS from './setup';

Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
    test_1: {
        str: 'test3',
    },
    test_2: {
        str: 'test4',
    },
    test_3: {
        str: 'test5',
    },
});

Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
    test_2: {
        str: 'test4',
    },
    // @ts-expect-error COLLECTION.TEST_KEY is object, not a number
    test_3: 2,
});

Onyx.mergeCollection(ONYX_KEYS.COLLECTION.TEST_KEY, {
    // @ts-expect-error invalidKey is not a valid key
    invalidKey: {
        str: 'test3',
    },
});
