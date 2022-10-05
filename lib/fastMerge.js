// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

let mergeObject;

/**
* Is the object Mergeable
*
* @param {*} val
* @returns {*|boolean}
*/
function isMergeableObject(val) {
    const nonNullObject = val && typeof val === 'object';
    return nonNullObject
    && Object.prototype.toString.call(val) !== '[object RegExp]'
    && Object.prototype.toString.call(val) !== '[object Date]';
}

/**
  * @param {{}|[]} target
  * @param {{}|[]} source
  * @returns {{}|[]}
  */
function fastMerge(target, source) {
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const array = Array.isArray(source); // lodash adds a small overhead so we don't use it here
    if (array) {
        return source;
    }
    return mergeObject(target, source);
}

/**
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
*/
mergeObject = function (target, source) {
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
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const sourceKeys = Object.keys(source); // lodash adds a small overhead so we don't use it here
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];
        if (source[key] === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = source[key];
        } else {
            destination[key] = fastMerge(target[key], source[key]);
        }
    }

    return destination;
};

export default fastMerge;
