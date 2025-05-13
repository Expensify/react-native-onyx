import _ from 'underscore';
import type {OnyxInput, OnyxKey} from '../types';
import logMessages from '../logMessages';
import utils from '../utils';
import Logger from '../Logger';

function isValidChange<TKey extends OnyxKey>(key: TKey, change: unknown, existingValue: unknown): change is OnyxInput<TKey> {
    const {isCompatible, existingValueType, newValueType} = utils.checkCompatibilityWithExistingValue(change, existingValue);
    if (!isCompatible) {
        Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'merge', existingValueType, newValueType));
    }
    return isCompatible;
}

function logMergeCall(key: OnyxKey, changes: unknown, hasChanged = true) {
    Logger.logInfo(`merge called for key: ${key}${_.isObject(changes) ? ` properties: ${_.keys(changes).join(',')}` : ''} hasChanged: ${hasChanged}`);
}

export {isValidChange, logMergeCall};
