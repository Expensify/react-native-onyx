import {IsEqual} from 'type-fest';
import {CollectionKey, CollectionKeyBase, GetOnyxValue, Key, KeyValueMapping, OnyxKey, Selector} from './types';

type BaseMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = {
    canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
    initWithStoredValues?: boolean;
    // TODO: Remove this when types are finished.
    onyxValue?: GetOnyxValue<TOnyxKey> | null;
};

// TODO: Still being worked on.
type Mapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends Key> = BaseMapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey> &
    (
        | (IsEqual<KeyValueMapping[TOnyxKey] | null, TOnyxProps[TOnyxProp]> extends true
              ? {
                    key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey);
                }
              : never)
        | {
              key: TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
        | {
              key: (props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
    );

// TODO: Still being worked on.
type CollectionMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends CollectionKeyBase> = BaseMapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey> &
    (
        | (IsEqual<Record<string, KeyValueMapping[TOnyxKey] | null> | null, TOnyxProps[TOnyxProp]> extends true
              ? {
                    key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey);
                }
              : never)
        | {
              key: TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
        | {
              key: (props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
    );

// TODO: Still being worked on.
type CollectionRecordMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends CollectionKey> = BaseMapping<
    TComponentProps,
    TOnyxProps,
    TOnyxProp,
    TOnyxKey
> &
    (
        | (IsEqual<KeyValueMapping[TOnyxKey] | null, TOnyxProps[TOnyxProp]> extends true
              ? {
                    key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey);
                }
              : never)
        | {
              key: TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
        | {
              key: (props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
    );

// TODO: Still being worked on.
type OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in Key]: Mapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[Key];

// TODO: Still being worked on.
type OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in CollectionKeyBase]: CollectionMapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[CollectionKeyBase];

// TODO: Still being worked on.
type OnyxPropCollectionRecordMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in CollectionKey]: CollectionRecordMapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[CollectionKey];

declare function withOnyx<TComponentProps, TOnyxProps>(
    mapping: {
        [TOnyxProp in keyof TOnyxProps]:
            | OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp>
            | OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp>
            | OnyxPropCollectionRecordMapping<TComponentProps, TOnyxProps, TOnyxProp>;
    },
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;

export default withOnyx;
export {Mapping, CollectionMapping, CollectionRecordMapping, OnyxPropMapping, GetOnyxValue, Selector};
