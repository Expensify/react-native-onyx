"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setShouldDebugSetState = exports.logSetStateCall = void 0;
const transform_1 = __importDefault(require("lodash/transform"));
const fast_equals_1 = require("fast-equals");
let debugSetState = false;
function setShouldDebugSetState(debug) {
    debugSetState = debug;
}
exports.setShouldDebugSetState = setShouldDebugSetState;
/**
 * Deep diff between two objects. Useful for figuring out what changed about an object from one render to the next so
 * that state and props updates can be optimized.
 */
function diffObject(object, base) {
    return (0, transform_1.default)(object, (result, value, key) => {
        if ((0, fast_equals_1.deepEqual)(value, base[key])) {
            return;
        }
        if (typeof value === 'object' && typeof base[key] === 'object') {
            // eslint-disable-next-line no-param-reassign
            result[key] = diffObject(value, base[key]);
        }
        else {
            // eslint-disable-next-line no-param-reassign
            result[key] = value;
        }
    });
}
/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 */
function logSetStateCall(mapping, previousValue, newValue, caller, keyThatChanged) {
    if (!debugSetState) {
        return;
    }
    const logParams = {};
    if (keyThatChanged) {
        logParams.keyThatChanged = keyThatChanged;
    }
    if (newValue && previousValue && typeof newValue === 'object' && typeof previousValue === 'object') {
        logParams.difference = diffObject(previousValue, newValue);
    }
    else {
        logParams.previousValue = previousValue;
        logParams.newValue = newValue;
    }
    console.debug(`[Onyx-Debug] ${'displayName' in mapping && mapping.displayName} setState() called. Subscribed to key '${mapping.key}' (${caller})`, logParams);
}
exports.logSetStateCall = logSetStateCall;
