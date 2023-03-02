import _ from 'underscore';
import fastMerge from './fastMerge';

/**
 * Given an Onyx key and value this method will combine all queued
 * value updates and return a single value. Merge attempts are
 * batched. They must occur after a single call to get() so we
 * can avoid race conditions.
 *
 * @private
 * @param {String} key
 * @param {*} data
 * @param {Array} mergeQueue
 * @returns {*}
 */
function applyMerge(key, data, mergeQueue) {
    const mergeValues = mergeQueue[key];

    if (_.isObject(data) || _.every(mergeValues, _.isObject)) {
        // Object values are merged one after the other
        return _.reduce(mergeValues, (modifiedData, mergeValue) => {
            // lodash adds a small overhead so we don't use it here
            // eslint-disable-next-line prefer-object-spread, rulesdir/prefer-underscore-method
            const newData = Object.assign({}, fastMerge(modifiedData, mergeValue));

            // We will also delete any object keys that are undefined or null.
            // Deleting keys is not supported by AsyncStorage so we do it this way.
            // Remove all first level keys that are explicitly set to null.
            return _.omit(newData, (value, finalObjectKey) => _.isNull(mergeValue[finalObjectKey]));
        }, data || {});
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return _.last(mergeValues);
}

export default applyMerge;
