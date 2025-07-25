import cache from '../OnyxCache';
import OnyxUtils from '../OnyxUtils';
import Storage from '../storage';
import type {OnyxInput, OnyxKey, OnyxValue} from '../types';
import type {ApplyMerge} from './types';

const applyMerge: ApplyMerge = <TKey extends OnyxKey, TValue extends OnyxInput<TKey> | undefined, TChange extends OnyxInput<TKey> | undefined>(
    key: TKey,
    existingValue: TValue,
    validChanges: TChange[],
) => {
    const {result: mergedValue} = OnyxUtils.mergeChanges(validChanges, existingValue);

    // In cache, we don't want to remove the key if it's null to improve performance and speed up the next merge.
    const hasChanged = cache.hasValueChanged(key, mergedValue);

    // Logging properties only since values could be sensitive things we don't want to log.
    OnyxUtils.logKeyChanged(OnyxUtils.METHOD.MERGE, key, mergedValue, hasChanged);

    // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
    const updatePromise = OnyxUtils.broadcastUpdate(key, mergedValue as OnyxValue<TKey>, hasChanged);

    // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
    if (!hasChanged) {
        return Promise.resolve({mergedValue, updatePromise});
    }

    // For web platforms we use `setItem` since the object was already merged with its changes before.
    return Storage.setItem(key, mergedValue as OnyxValue<TKey>).then(() => ({
        mergedValue,
        updatePromise,
    }));
};

const OnyxMerge = {
    applyMerge,
};

export default OnyxMerge;
