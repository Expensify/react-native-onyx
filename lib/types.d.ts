import {IsEqual, ValueOf} from 'type-fest';

type MergeBy<TObject, TOtherObject> = Omit<TObject, keyof TOtherObject> & TOtherObject;

type DeepRecord<TKey extends string | number | symbol, TValue> = {[key: string]: TValue | DeepRecord<TKey, TValue>};

type TypeOptions = MergeBy<
    {
        keys: string;
        collectionKeys: string;
        values: Record<string, unknown>;
    },
    CustomTypeOptions
>;

interface CustomTypeOptions {}

type Key = TypeOptions['keys'];
type CollectionKeyBase = TypeOptions['collectionKeys'];
type CollectionKey = `${CollectionKeyBase}${string}`;

type OnyxKey = Key | CollectionKey;
type KeyValueMapping = TypeOptions['values'];

// TODO: Still being worked on.
type GetOnyxValue<K extends Key | `${CollectionKeyBase}${string}`> = K extends Key
    ? KeyValueMapping[K]
    : K extends `${CollectionKeyBase}`
    ? Record<string, KeyValueMapping[K] | null>
    : KeyValueMapping[K];

// type Selector<TKey extends OnyxKey, TReturnType> = KeyValueMapping[TKey] extends object | string | number | boolean
//     ? (value: KeyValueMapping[TKey] | null) => TReturnType
//     : KeyValueMapping[TKey] extends unknown
//     ? (value: unknown) => unknown
//     : never;

// TODO: Still being worked on.
type Selector<TKey extends OnyxKey, TReturnType> = IsEqual<KeyValueMapping[TKey], unknown> extends true ? (value: unknown) => unknown : (value: KeyValueMapping[TKey] | null) => TReturnType;

// type Selector<TKey extends OnyxKey, TReturnType> = IsEqual<GetOnyxValue<TKey>, unknown> extends true ? (value: unknown) => unknown : (value: GetOnyxValue<TKey> | null) => TReturnType;

export {CollectionKey, CollectionKeyBase, CustomTypeOptions, DeepRecord, Key, MergeBy, OnyxKey, KeyValueMapping, Selector, GetOnyxValue, TypeOptions};
