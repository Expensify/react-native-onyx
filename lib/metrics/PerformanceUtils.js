import lodashTransform from 'lodash/transform';
import _ from 'underscore';
import {dequal} from 'dequal/lite';

let shouldCaptureMetrics = false;

/**
 * @param {Boolean} captureMetrics
 */
function setShouldCaptureMetrics(captureMetrics) {
    shouldCaptureMetrics = captureMetrics;
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
            if (dequal(value, comparisonObject[key])) {
                return;
            }

            // eslint-disable-next-line no-param-reassign
            result[key] = (_.isObject(value) && _.isObject(comparisonObject[key]))
                ? changes(value, comparisonObject[key])
                : value;
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
 * @param {String} keyThatChanged
 */
function logSetStateCall(mapping, previousValue, newValue, caller, keyThatChanged) {
    if (!shouldCaptureMetrics) {
        return;
    }

    const difference = diffObject(previousValue, newValue);
    console.debug(`[Onyx] setState() in ${caller} because ${mapping.displayName} subscribed to key ${mapping.key}`, {
        keyThatChanged,
        previousValue,
        newValue,
        difference,
    });
}

/**
 * Timing helper which will tell us how long it took to call the setState() method on a connected React component.
 *
 * @param {Object} params
 * @param {Function} setStateFunction
 * @param {Object} mapping
 * @param {String} keyThatChanged
 * @param {String} caller
 */
function withSetStateTrace({
    setStateFunction, mapping, keyThatChanged, caller,
}) {
    if (!shouldCaptureMetrics) {
        setStateFunction();
        return;
    }

    const start = performance.now();
    setStateFunction();
    const end = performance.now();
    console.debug(`[Onyx] setState() took ${end - start} ms`, {
        component: mapping.displayName,
        subscribedTo: mapping.key,
        keyThatChanged,
        caller,
    });
}

export {
    logSetStateCall,
    withSetStateTrace,
    setShouldCaptureMetrics,
};
