import _ from 'underscore';

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
* @param {Boolean} shouldRemoveNullObjectValues
* @returns {Object}
*/
function mergeObject(target, source, shouldRemoveNullObjectValues = true) {
    const targetAndSourceIdentical = target === source;

    const destination = {};
    if (isMergeableObject(target)) {
        // lodash adds a small overhead so we don't use it here
        // eslint-disable-next-line rulesdir/prefer-underscore-method
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];

            // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
            if (shouldRemoveNullObjectValues && (_.isNull(target[key]) || _.isNull(source[key]))) {
                // eslint-disable-next-line no-continue
                continue;
            }

            destination[key] = target[key];
        }
    }

    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];

        // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
        if (shouldRemoveNullObjectValues && _.isNull(source[key])) {
            // eslint-disable-next-line no-continue
            continue;
        }

        if (!isMergeableObject(source[key]) || !target[key]) {
            if (targetAndSourceIdentical) {
                // eslint-disable-next-line no-continue
                continue;
            }
            destination[key] = source[key];
        } else {
            // eslint-disable-next-line no-use-before-define
            destination[key] = fastMerge(target[key], source[key], shouldRemoveNullObjectValues);
        }
    }

    return destination;
}

/**
 * Merges two objects and removes null values if "shouldRemoveNullObjectValues" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 *
* @param {Object|Array} target
* @param {Object|Array} source
* @param {Boolean} shouldRemoveNullObjectValues
* @returns {Object|Array}
*/
function fastMerge(target, source, shouldRemoveNullObjectValues = true) {
    // We have to ignore arrays and nullish values here,
    // otherwise "mergeObject" will throw an error,
    // because it expects an object as "source"
    if (_.isArray(source) || _.isNull(source) || _.isUndefined(source)) {
        return source;
    }
    return mergeObject(target, source, shouldRemoveNullObjectValues);
}

export default {areObjectsEmpty, fastMerge};

