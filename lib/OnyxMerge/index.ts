import _ from 'underscore';
import * as Logger from '../Logger';
import OnyxUtils from '../OnyxUtils';
import type {OnyxKey, OnyxValue} from '../types';
import cache from '../OnyxCache';
import Storage from '../storage';
import type {ApplyMerge} from './types';

const applyMerge: ApplyMerge = <TKey extends OnyxKey>(key: TKey, existingValue: OnyxValue<TKey>, validChanges: unknown[]) => {
    const {result: mergedValue} = OnyxUtils.mergeChanges(validChanges, existingValue);

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

    return Storage.setItem(key, mergedValue as OnyxValue<TKey>).then(() => ({
        mergedValue,
        updatePromise,
    }));
};

const OnyxMerge = {
    applyMerge,
};

export default OnyxMerge;
