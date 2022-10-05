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
    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const array = Array.isArray(source);
    if (array) {
        return source;
    }
    return mergeObject(target, source);
}

export default fastMerge;
