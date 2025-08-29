import type {OnyxInput, OnyxKey} from '../types';

type ApplyMergeResult<TValue> = {
    mergedValue: TValue;
    updatePromise: Promise<void>;
};

type ApplyMerge = <TKey extends OnyxKey, TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | null>(
    key: TKey,
    existingValue: TValue,
    validChanges: TChange[],
    isFromUpdate?: boolean,
) => Promise<ApplyMergeResult<TChange>>;

export type {ApplyMerge, ApplyMergeResult};
