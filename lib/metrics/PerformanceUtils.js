import lodashTransform from 'lodash/transform';
import _ from 'underscore';

let debugSetState = false;

/**
 * @param {Boolean} debug
 */
function setShouldDebugSetState(debug) {
    debugSetState = debug;
}

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
        return lodashTransform(obj, (result, value, key) => {
            if (_.isEqual(value, comparisonObject[key])) {
                return;
            }

            // eslint-disable-next-line no-param-reassign
            result[key] = _.isObject(value) && _.isObject(comparisonObject[key]) ? changes(value, comparisonObject[key]) : value;
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
    if (_.isObject(newValue) && _.isObject(previousValue)) {
        logParams.difference = diffObject(previousValue, newValue);
    } else {
        logParams.previousValue = previousValue;
        logParams.newValue = newValue;
    }

    console.debug(`[Onyx-Debug] ${mapping.displayName} setState() called. Subscribed to key '${mapping.key}' (${caller})`, logParams);
}

export {logSetStateCall, setShouldDebugSetState};
