import lodashTransform from 'lodash/transform';
import {deepEqual} from 'fast-equals';
import type {OnyxKey} from './types';
import type {ConnectOptions} from './Onyx';

type UnknownObject = Record<string, unknown>;

type LogParams = {
    keyThatChanged?: string;
    difference?: unknown;
    previousValue?: unknown;
    newValue?: unknown;
};

let debugSetState = false;

function setShouldDebugSetState(debug: boolean) {
    debugSetState = debug;
}

/**
 * Deep diff between two objects. Useful for figuring out what changed about an object from one render to the next so
 * that state and props updates can be optimized.
 */
function diffObject<TObject extends UnknownObject, TBase extends UnknownObject>(object: TObject, base: TBase): UnknownObject {
    return lodashTransform(object, (result: UnknownObject, value, key) => {
        if (deepEqual(value, base[key])) {
            return;
        }

        if (typeof value === 'object' && typeof base[key] === 'object') {
            // eslint-disable-next-line no-param-reassign
            result[key] = diffObject(value as UnknownObject, base[key] as UnknownObject);
        } else {
            // eslint-disable-next-line no-param-reassign
            result[key] = value;
        }
    });
}

/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 */
function logSetStateCall<TKey extends OnyxKey>(mapping: ConnectOptions<TKey>, previousValue: unknown, newValue: unknown, caller: string, keyThatChanged?: string) {
    if (!debugSetState) {
        return;
    }

    const logParams: LogParams = {};
    if (keyThatChanged) {
        logParams.keyThatChanged = keyThatChanged;
    }
    if (newValue && previousValue && typeof newValue === 'object' && typeof previousValue === 'object') {
        logParams.difference = diffObject(previousValue as UnknownObject, newValue as UnknownObject);
    } else {
        logParams.previousValue = previousValue;
        logParams.newValue = newValue;
    }

    console.debug(`[Onyx-Debug] ${mapping.displayName} setState() called. Subscribed to key '${mapping.key}' (${caller})`, logParams);
}

export {logSetStateCall, setShouldDebugSetState};
