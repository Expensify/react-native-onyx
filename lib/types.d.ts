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
        values: Record<string, unknown>;
    },
    CustomTypeOptions
>;

interface CustomTypeOptions {}

type Key = TypeOptions['keys'];
type Value = TypeOptions['values'];

type Selector<TKey extends Key> = Value[TKey] extends object | string | number | boolean ? ((value: Value[TKey] | null) => Value[TKey] | null) | DeepKeyOf<Value[TKey]> : never;

export {MergeBy, DeepRecord, DeepKeyOf, TypeOptions, CustomTypeOptions, Key, Value, Selector};
