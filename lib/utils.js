import _ from 'underscore';

function areObjectsEmpty(a, b) {
    return typeof a === 'object' && typeof b === 'object' && _.isEmpty(a) && _.isEmpty(b);
}

// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

/**
 * @param {mixed} val
 * @returns {boolean}
 */
function isMergeableObject(val) {
    const nonNullObject = val != null ? typeof val === 'object' : false;
    return (
        nonNullObject &&
        Object.prototype.toString.call(val) !== '[object RegExp]' &&
        Object.prototype.toString.call(val) !== '[object Date]' &&
        // eslint-disable-next-line rulesdir/prefer-underscore-method
        !Array.isArray(val)
    );
}

/**
 * @param {Object} target
 * @param {Object} source
 * @param {Boolean} shouldRemoveNullObjectValues
 * @returns {Object}
 */
function mergeObject(target, source, shouldRemoveNullObjectValues = true) {
    const destination = {};
    if (isMergeableObject(target)) {
        // lodash adds a small overhead so we don't use it here
        // eslint-disable-next-line rulesdir/prefer-underscore-method
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];

            // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
            const isSourceOrTargetNull = target[key] === null || source[key] === null;
            const shouldOmitSourceKey = shouldRemoveNullObjectValues && isSourceOrTargetNull;

            if (!shouldOmitSourceKey) {
                destination[key] = target[key];
            }
        }
    }

    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];

        // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
        const shouldOmitSourceKey = shouldRemoveNullObjectValues && source[key] === null;

        // If we pass undefined as the updated value for a key, we want to generally ignore it
        const isSourceKeyUndefined = source[key] === undefined;

        if (!isSourceKeyUndefined && !shouldOmitSourceKey) {
            const isSourceKeyMergable = isMergeableObject(source[key]);

            if (isSourceKeyMergable && target[key]) {
                if (!shouldRemoveNullObjectValues || isSourceKeyMergable) {
                    // eslint-disable-next-line no-use-before-define
                    destination[key] = fastMerge(target[key], source[key], shouldRemoveNullObjectValues);
                }
            } else if (!shouldRemoveNullObjectValues || source[key] !== null) {
                destination[key] = source[key];
            }
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
    if (_.isArray(source) || source === null || source === undefined) {
        return source;
    }
    return mergeObject(target, source, shouldRemoveNullObjectValues);
}

function removeNestedNullValues(value) {
    if (typeof value === 'object' && !_.isArray(value)) {
        return fastMerge(value, value);
    }

    return value;
}

function formatActionName(method, key) {
    return key ? `${method.toUpperCase()}/${key}` : method.toUpperCase();
}

export default {areObjectsEmpty, fastMerge, formatActionName, removeNestedNullValues};
