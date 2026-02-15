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

type OnyxCollectionValues = {
    [ONYX_KEYS.COLLECTION.TEST_KEY]: {str: string};
};

declare module '../../dist/types' {
    interface CustomTypeOptions {
        keys: keyof OnyxValues;
        collectionKeys: keyof OnyxCollectionValues;
        values: OnyxValues & OnyxCollectionValues;
    }
}

export default ONYX_KEYS;
