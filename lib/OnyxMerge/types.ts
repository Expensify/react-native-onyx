import type {OnyxKey, OnyxValue} from '../types';

type ApplyMergeResult = {
    mergedValue: OnyxValue<OnyxKey>;
    updatePromise: Promise<void>;
};

type ApplyMerge = <TKey extends OnyxKey>(key: TKey, existingValue: OnyxValue<TKey>, validChanges: unknown[]) => Promise<ApplyMergeResult>;

export type {ApplyMerge, ApplyMergeResult};
