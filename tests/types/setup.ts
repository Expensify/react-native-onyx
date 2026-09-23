import '../../dist/types';

const ONYX_KEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
} as const;

type OnyxValues = {
    [ONYX_KEYS.TEST_KEY]: string;
};

// The optional list member makes the write-back checks in get.ts depend on the input types accepting
// read-only data, because a readonly array is not assignable to a mutable one.
type OnyxCollectionValues = {
    [ONYX_KEYS.COLLECTION.TEST_KEY]: {str: string; list?: string[]};
};

declare module '../../dist/types' {
    interface CustomTypeOptions {
        keys: keyof OnyxValues;
        collectionKeys: keyof OnyxCollectionValues;
        values: OnyxValues & OnyxCollectionValues;
    }
}

export default ONYX_KEYS;
