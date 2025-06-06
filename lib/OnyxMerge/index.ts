import type {OnyxMergeInput, OnyxKey, OnyxValue, OnyxInput} from '../types';
import OnyxUtils from '../OnyxUtils';
import Storage from '../storage';
import Logger from '../Logger';
import cache from '../OnyxCache';
import {isValidChange, logMergeCall} from './mergeUtils';

function merge<TKey extends OnyxKey>(key: TKey, change: OnyxMergeInput<TKey>) {
    const mergeQueue = OnyxUtils.getMergeQueue();
    const mergeQueuePromise = OnyxUtils.getMergeQueuePromise();

    // Top-level undefined values are ignored
    // Therefore, we need to prevent adding them to the merge queue
    if (change === undefined) {
        return mergeQueue[key] ? mergeQueuePromise[key] : Promise.resolve();
    }

    // Merge attempts are batched together. The delta should be applied after a single call to get() to prevent a race condition.
    // Using the initial value from storage in subsequent merge attempts will lead to an incorrect final merged value.
    if (mergeQueue[key]) {
        mergeQueue[key].push(change);
        return mergeQueuePromise[key];
    }
    mergeQueue[key] = [change];

    mergeQueuePromise[key] = OnyxUtils.get(key).then((existingValue) => {
        // Calls to Onyx.set after a merge will terminate the current merge process and clear the merge queue
        if (mergeQueue[key] == null) {
            return Promise.resolve();
        }

        try {
            // We first only merge the changes, so we can provide these to the native implementation (SQLite uses only delta changes in "JSON_PATCH" to merge)
            // We don't want to remove null values from the "batchedDeltaChanges", because SQLite uses them to remove keys from storage natively.
            const validChanges = mergeQueue[key].filter((c) => isValidChange(key, c, existingValue)) as Array<OnyxInput<TKey>>;

            if (!validChanges.length) {
                return Promise.resolve();
            }

            // Clean up the write queue, so we don't apply these changes again
            delete mergeQueue[key];
            delete mergeQueuePromise[key];

            // If the last change is null, we remove the key from storage and cache and update the subscriber immediately.
            if (validChanges.at(-1) === null) {
                OnyxUtils.remove(key);
                // Logging properties only since values could be sensitive things we don't want to log
                Logger.logInfo(`merge called for key: ${key} wasRemoved: true`);
                return Promise.resolve();
            }

            // We merge the valid changes with the existing value to get the final merged value that will be stored.
            // We want to remove nested null values from the new value, because null implicates that the user wants to remove a value from storage.
            const newValue = OnyxUtils.applyMerge(existingValue, validChanges, true);
            const hasChanged = cache.hasValueChanged(key, newValue);

            logMergeCall(key, newValue, hasChanged);

            // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
            const updatePromise = OnyxUtils.broadcastUpdate(key, newValue as OnyxValue<TKey>, hasChanged);

            // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
            if (!hasChanged) {
                return updatePromise;
            }

            return Storage.setItem(key, newValue as OnyxValue<TKey>).then(() => {
                OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE, key, change, newValue);
                return updatePromise;
            });
        } catch (error) {
            Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
            return Promise.resolve();
        }
    });

    return mergeQueuePromise[key];
}

const OnyxMerge = {merge};

export default OnyxMerge;
