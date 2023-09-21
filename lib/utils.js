import * as _ from 'underscore';

function areObjectsEmpty(a, b) {
    return (
        typeof a === 'object'
        && typeof b === 'object'
        && _.isEmpty(a)
        && _.isEmpty(b)
    );
}

// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

/**
 * @param {mixed} val
 * @returns {boolean}
*/
function isMergeableObject(val) {
    const nonNullObject = val != null ? typeof val === 'object' : false;
    return (nonNullObject
  && Object.prototype.toString.call(val) !== '[object RegExp]'
  && Object.prototype.toString.call(val) !== '[object Date]');
}

/**
* @param {Object} target
* @param {Object} source
* @returns {Object}
*/
function mergeObject(target, source) {
    const destination = {};
    if (isMergeableObject(target)) {
        // lodash adds a small overhead so we don't use it here
        // eslint-disable-next-line rulesdir/prefer-underscore-method
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];
            destination[key] = target[key];
        }
    }

    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];
        if (source[key] === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = source[key];
        } else {
            // eslint-disable-next-line no-use-before-define
            destination[key] = fastMerge(target[key], source[key]);
        }
    }

    return destination;
}

/**
* @param {Object|Array} target
* @param {Object|Array} source
* @returns {Object|Array}
*/
function fastMerge(target, source) {
    if (_.isArray(source) || _.isNull(source) || _.isUndefined(source)) {
        return source;
    }
    return mergeObject(target, source);
}

/**
 * We generally want to remove top-level nullish values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use  JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove nullish values for "set" operations.
 * On web, IndexedDB will keep the top-level keys along with a null value and this uses up storage and memory.
 * This method will ensure that keys for null values are removed before an object is written to disk and cache so that all platforms are storing the data in the same efficient way.
 * @private
 * @param {*} value
 * @returns {*}
 */
function removeNullObjectValues(value) {
    if (_.isArray(value) || !_.isObject(value)) {
        return value;
    }

    const objectWithoutNullObjectValues = _.omit(value, objectValue => _.isNull(objectValue));

    return objectWithoutNullObjectValues;
}

export default {removeNullObjectValues, areObjectsEmpty, fastMerge};

