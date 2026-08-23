import type {OnyxInput, OnyxKey} from '../types';

type ApplyMergeResult<TValue> = {
    mergedValue: TValue;
};

type ApplyMerge = <TKey extends OnyxKey, TValue extends OnyxInput<TKey>, TChange extends OnyxInput<TKey>>(
    key: TKey,
    existingValue: TValue,
    validChanges: TChange[],
) => Promise<ApplyMergeResult<TChange>>;

export type {ApplyMerge, ApplyMergeResult};
