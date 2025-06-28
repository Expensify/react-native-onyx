import type {OnyxMergeInput, OnyxKey, OnyxValue} from '../types';
import OnyxUtils from '../OnyxUtils';
import Storage from '../storage';
import Logger from '../Logger';
import cache from '../OnyxCache';
import {isValidChange, logMergeCall} from './mergeUtils';

const nativeBroadcastPromise: Record<OnyxKey, Promise<void>> = {};

function merge<TKey extends OnyxKey>(key: TKey, change: OnyxMergeInput<TKey>) {
    // Top-level undefined values are ignored
    // Therefore, we need to prevent adding them to the merge queue
    if (change === undefined) {
        return Promise.resolve();
    }

    // On mobile, we can get the existing value synchronously through NitroSQLite,
    // therefore we don't need to batch merge changes into a merge queue.
    const existingValue = Storage.getItemSync(key);

    if (!isValidChange(key, change, existingValue)) {
        return Promise.resolve();
    }

    if (change === null) {
        Logger.logInfo(`merge called for key: ${key} wasRemoved: true`);
        return OnyxUtils.remove(key);
    }

    // On mobile, we want to immediately apply the change
    Storage.mergeItem(key, change);

    nativeBroadcastPromise[key] = (nativeBroadcastPromise[key] ?? Promise.resolve()).then(() => {
        try {
            // We merge the valid changes with the existing value to get the final merged value that will be stored.
            // We want to remove nested null values from the new value, because null implicates that the user wants to remove a value from storage.
            const newValue = OnyxUtils.applyMerge(existingValue, [change], true);
            const hasChanged = cache.hasValueChanged(key, newValue);

            logMergeCall(key, newValue, hasChanged);

            // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE, key, change, newValue);
            return OnyxUtils.broadcastUpdate(key, newValue as OnyxValue<TKey>, hasChanged);
        } catch (error) {
            Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
            return Promise.resolve();
        }
    });

    return nativeBroadcastPromise[key];
}

const OnyxMerge = {merge};

export default OnyxMerge;
