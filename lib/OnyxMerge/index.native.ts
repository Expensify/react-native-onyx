import _ from 'underscore';
import * as Logger from '../Logger';
import OnyxUtils from '../OnyxUtils';
import type {OnyxKey, OnyxValue} from '../types';
import cache from '../OnyxCache';
import Storage from '../storage';
import type {ApplyMerge} from './types';

const applyMerge: ApplyMerge = <TKey extends OnyxKey>(key: TKey, existingValue: OnyxValue<TKey>, validChanges: unknown[]) => {
    // If any of the changes is null, we need to discard the existing value.
    const baseValue = validChanges.includes(null) ? undefined : existingValue;

    // We first batch the changes into a single change with object removal marks,
    // so that SQLite can merge the changes more efficiently.
    const {result: batchedChanges, replaceNullPatches} = OnyxUtils.mergeAndMarkChanges(validChanges);

    // We then merge the batched changes with the existing value, because we need to final merged value to broadcast to subscribers.
    const {result: mergedValue} = OnyxUtils.mergeChanges([batchedChanges], baseValue);

    // In cache, we don't want to remove the key if it's null to improve performance and speed up the next merge.
    const hasChanged = cache.hasValueChanged(key, mergedValue);

    // Logging properties only since values could be sensitive things we don't want to log.
    Logger.logInfo(`merge called for key: ${key}${_.isObject(mergedValue) ? ` properties: ${_.keys(mergedValue).join(',')}` : ''} hasChanged: ${hasChanged}`);

    // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
    const updatePromise = OnyxUtils.broadcastUpdate(key, mergedValue as OnyxValue<TKey>, hasChanged);

    // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
    if (!hasChanged) {
        return Promise.resolve({mergedValue, updatePromise});
    }

    return Storage.mergeItem(key, batchedChanges as OnyxValue<TKey>, replaceNullPatches).then(() => ({
        mergedValue,
        updatePromise,
    }));
};

const OnyxMerge = {
    applyMerge,
};

export default OnyxMerge;
