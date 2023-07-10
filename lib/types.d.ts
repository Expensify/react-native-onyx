type MergeBy<T, K> = Omit<T, keyof K> & K;

type DeepRecord<K extends string | number | symbol, T> = {[key: string]: T | DeepRecord<K, T>};

type DeepKeyOf<T> = T extends object
    ? {
          [K in keyof T & (string | number)]: T[K] extends Record<string, unknown> ? `${K}.${DeepKeyOf<T[K]>}` | K : K;
      }[keyof T & (string | number)]
    : T;

type TypeOptions = MergeBy<
    {
        keys: string;
        values: Record<string, unknown>;
    },
    CustomTypeOptions
>;

interface CustomTypeOptions {}

export {MergeBy, DeepRecord, DeepKeyOf, TypeOptions, CustomTypeOptions};
