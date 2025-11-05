import type {OnyxUpdate} from '../../dist/types';
import ONYX_KEYS from './setup';

const onyxUpdate: OnyxUpdate = {
    onyxMethod: 'set',
    key: ONYX_KEYS.TEST_KEY,
    value: 'string',
};

const onyxUpdateError: OnyxUpdate = {
    onyxMethod: 'set',
    key: ONYX_KEYS.TEST_KEY,
    // @ts-expect-error TEST_KEY is a string, not a number
    value: 2,
};

const onyxUpdateCollection: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    value: {
        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: {
            str: 'test',
        },
        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {
            str: 'test2',
        },
    },
};

// @ts-expect-error COLLECTION.TEST_KEY is an object, not a number
const onyxUpdateCollectionError: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    value: {
        [`${ONYX_KEYS.COLLECTION.TEST_KEY}1`]: 2,
    },
};

const onyxUpdateCollectionError2: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    value: {
        [`${ONYX_KEYS.COLLECTION.TEST_KEY}2`]: {
            // @ts-expect-error nonExistingKey is not a valid key
            nonExistingKey: 'test2',
        },
    },
};

// @ts-expect-error COLLECTION.TEST_KEY is invalid key, it is missing the suffix
const onyxUpdateCollectionError3: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    value: {
        [ONYX_KEYS.COLLECTION.TEST_KEY]: {
            str: 'test2',
        },
    },
};
