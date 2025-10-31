import type {OnyxUpdate} from '../../dist/types';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

type OnyxValues = {
    [ONYX_KEYS.TEST_KEY]: string;
};

type OnyxCollectionValues = {
    [ONYX_KEYS.COLLECTION.TEST_KEY]: {str: string};
};

declare module '../../dist/types' {
    interface CustomTypeOptions {
        keys: keyof OnyxValues;
        collectionKeys: keyof OnyxCollectionValues;
        values: OnyxValues;
    }
}

const onyxUpdate: OnyxUpdate = {
    onyxMethod: 'set',
    key: ONYX_KEYS.TEST_KEY,
    value: 'string',
};

const onyxUpdateError: OnyxUpdate = {
    onyxMethod: 'set',
    key: 'string',
    // @ts-expect-error TEST_KEY is a string, not a number
    value: 2,
};

const onyxUpdateCollection: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    value: {
        [ONYX_KEYS.COLLECTION.TEST_KEY]: {str: 'test'},
    },
};

const onyxUpdateCollectionError: OnyxUpdate = {
    onyxMethod: 'mergecollection',
    key: ONYX_KEYS.COLLECTION.TEST_KEY,
    // @ts-expect-error TEST_KEY is an object, not a number
    value: 2,
};
