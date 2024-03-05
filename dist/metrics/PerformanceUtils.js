"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setShouldDebugSetState = exports.logSetStateCall = void 0;
const transform_1 = __importDefault(require("lodash/transform"));
const underscore_1 = __importDefault(require("underscore"));
let debugSetState = false;
/**
 * @param {Boolean} debug
 */
function setShouldDebugSetState(debug) {
    debugSetState = debug;
}
exports.setShouldDebugSetState = setShouldDebugSetState;
/**
 * Deep diff between two objects. Useful for figuring out what changed about an object from one render to the next so
 * that state and props updates can be optimized.
 *
 * @param  {Object} object
 * @param  {Object} base
 * @return {Object}
 */
function diffObject(object, base) {
    function changes(obj, comparisonObject) {
        return (0, transform_1.default)(obj, (result, value, key) => {
            if (underscore_1.default.isEqual(value, comparisonObject[key])) {
                return;
            }
            // eslint-disable-next-line no-param-reassign
            result[key] = underscore_1.default.isObject(value) && underscore_1.default.isObject(comparisonObject[key]) ? changes(value, comparisonObject[key]) : value;
        });
    }
    return changes(object, base);
}
/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 *
 * @param {Object} mapping
 * @param {*} previousValue
 * @param {*} newValue
 * @param {String} caller
 * @param {String} [keyThatChanged]
 */
function logSetStateCall(mapping, previousValue, newValue, caller, keyThatChanged) {
    if (!debugSetState) {
        return;
    }
    const logParams = {};
    if (keyThatChanged) {
        logParams.keyThatChanged = keyThatChanged;
    }
    if (underscore_1.default.isObject(newValue) && underscore_1.default.isObject(previousValue)) {
        logParams.difference = diffObject(previousValue, newValue);
    }
    else {
        logParams.previousValue = previousValue;
        logParams.newValue = newValue;
    }
    console.debug(`[Onyx-Debug] ${mapping.displayName} setState() called. Subscribed to key '${mapping.key}' (${caller})`, logParams);
}
exports.logSetStateCall = logSetStateCall;
