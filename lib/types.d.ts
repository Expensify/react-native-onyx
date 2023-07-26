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
type CollectionKey = TypeOptions['collectionKeys'];

type OnyxKey = Key | CollectionKey;
type KeyValueMapping = TypeOptions['values'];

type Selector<TKey extends OnyxKey, TReturnType> = KeyValueMapping[TKey] extends object | string | number | boolean
    ? (value: KeyValueMapping[TKey] | null) => TReturnType
    : KeyValueMapping[TKey] extends unknown
    ? (value: unknown) => unknown
    : never;

export {CollectionKey, CustomTypeOptions, DeepRecord, Key, MergeBy, OnyxKey, KeyValueMapping, Selector, TypeOptions};
