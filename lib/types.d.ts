type MergeBy<TObject, TOtherObject> = Omit<TObject, keyof TOtherObject> & TOtherObject;

type DeepRecord<TKey extends string | number | symbol, TValue> = {[key: string]: TValue | DeepRecord<TKey, TValue>};

type DeepKeyOf<TObject> = TObject extends object
    ? {
          [TKey in keyof TObject & (string | number)]: TObject[TKey] extends Record<string, unknown> ? `${TKey}.${DeepKeyOf<TObject[TKey]>}` | TKey : TKey;
      }[keyof TObject & (string | number)]
    : TObject;

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
type Value = TypeOptions['values'];

type Selector<TKey extends Key | CollectionKey, TReturnType> = Value[TKey] extends object | string | number | boolean
    ? ((value: Value[TKey] | null) => TReturnType) | string
    : Value[TKey] extends unknown
    ? ((value: unknown) => unknown) | string
    : never;

export {CollectionKey, CustomTypeOptions, DeepKeyOf, DeepRecord, Key, MergeBy, Selector, TypeOptions, Value};
