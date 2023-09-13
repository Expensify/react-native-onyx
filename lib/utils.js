import _ from 'underscore';

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

export default {removeNullObjectValues};
