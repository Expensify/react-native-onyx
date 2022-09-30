// Mostly copied from  https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

function isMergeableObject(val) {
    const nonNullObject = val && typeof val === 'object';
    return nonNullObject
    && Object.prototype.toString.call(val) !== '[object RegExp]'
    && Object.prototype.toString.call(val) !== '[object Date]';
}

function mergeObject(target, source) {
    const destination = {};
    if (isMergeableObject(target)) {
        // eslint-disable-next-line rulesdir/prefer-underscore-method
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];
            destination[key] = target[key];
        }
    }
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = source[key];
        } else {
            // eslint-disable-next-line no-use-before-define
            destination[key] = merge(target[key], source[key]);
        }
    }

    return destination;
}

// eslint-disable-next-line import/prefer-default-export, rulesdir/no-inline-named-export
export function merge(target, source) {
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const array = Array.isArray(source);
    if (array) {
        return source;
    }
    return mergeObject(target, source);
}
