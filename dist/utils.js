"use strict";
/* eslint-disable @typescript-eslint/prefer-for-of */
Object.defineProperty(exports, "__esModule", { value: true });
/** Checks whether the given object is an object and not null/undefined. */
function isEmptyObject(obj) {
    return typeof obj === 'object' && Object.keys(obj || {}).length === 0;
}
// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1
/**
 * Checks whether the given value can be merged. It has to be an object, but not an array, RegExp or Date.
 */
function isMergeableObject(value) {
    const isNonNullObject = value != null ? typeof value === 'object' : false;
    return isNonNullObject && !(value instanceof RegExp) && !(value instanceof Date) && !Array.isArray(value);
}
/**
 * Merges the source object into the target object.
 * @param target - The target object.
 * @param source - The source object.
 * @param shouldRemoveNestedNulls - If true, null object values will be removed.
 * @returns - The merged object.
 */
function mergeObject(target, source, shouldRemoveNestedNulls = true) {
    const destination = {};
    const targetObject = isMergeableObject(target) ? target : undefined;
    // First we want to copy over all keys from the target into the destination object,
    // in case "target" is a mergable object.
    // If "shouldRemoveNestedNulls" is true, we want to remove null values from the merged object
    // and therefore we need to omit keys where either the source or target value is null.
    if (targetObject) {
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const key in targetObject) {
            const sourceValue = source === null || source === void 0 ? void 0 : source[key];
            const targetValue = targetObject === null || targetObject === void 0 ? void 0 : targetObject[key];
            // If "shouldRemoveNestedNulls" is true, we want to remove null values from the merged object.
            // Therefore, if either target or source value is null, we want to prevent the key from being set.
            // targetValue should techincally never be "undefined", because it will always be a value from cache or storage
            // and we never set "undefined" there. Still, if there targetValue is undefined we don't want to set
            // the key explicitly to prevent loose undefined values in objects in cache and storage.
            const isSourceOrTargetNull = targetValue === undefined || targetValue === null || sourceValue === null;
            const shouldOmitTargetKey = shouldRemoveNestedNulls && isSourceOrTargetNull;
            if (!shouldOmitTargetKey) {
                destination[key] = targetValue;
            }
        }
    }
    // After copying over all keys from the target object, we want to merge the source object into the destination object.
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in source) {
        const sourceValue = source === null || source === void 0 ? void 0 : source[key];
        const targetValue = targetObject === null || targetObject === void 0 ? void 0 : targetObject[key];
        // If undefined is passed as the source value for a key, we want to generally ignore it.
        // If "shouldRemoveNestedNulls" is set to true and the source value is null,
        // we don't want to set/merge the source value into the merged object.
        const shouldIgnoreNullSourceValue = shouldRemoveNestedNulls && sourceValue === null;
        const shouldOmitSourceKey = sourceValue === undefined || shouldIgnoreNullSourceValue;
        if (!shouldOmitSourceKey) {
            // If the source value is a mergable object, we want to merge it into the target value.
            // If "shouldRemoveNestedNulls" is true, "fastMerge" will recursively
            // remove nested null values from the merged object.
            // If source value is any other value we need to set the source value it directly.
            if (isMergeableObject(sourceValue)) {
                // If the target value is null or undefined, we need to fallback to an empty object,
                // so that we can still use "fastMerge" to merge the source value,
                // to ensure that nested null values are removed from the merged object.
                const targetValueWithFallback = (targetValue !== null && targetValue !== void 0 ? targetValue : {});
                destination[key] = fastMerge(targetValueWithFallback, sourceValue, shouldRemoveNestedNulls);
            }
            else {
                destination[key] = sourceValue;
            }
        }
    }
    return destination;
}
/**
 * Merges two objects and removes null values if "shouldRemoveNestedNulls" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
function fastMerge(target, source, shouldRemoveNestedNulls = true) {
    // We have to ignore arrays and nullish values here,
    // otherwise "mergeObject" will throw an error,
    // because it expects an object as "source"
    if (Array.isArray(source) || source === null || source === undefined) {
        return source;
    }
    return mergeObject(target, source, shouldRemoveNestedNulls);
}
/** Deep removes the nested null values from the given value. */
function removeNestedNullValues(value) {
    if (typeof value === 'object' && !Array.isArray(value)) {
        const objectValue = value;
        return fastMerge(objectValue, objectValue);
    }
    return value;
}
/** Formats the action name by uppercasing and adding the key if provided. */
function formatActionName(method, key) {
    return key ? `${method.toUpperCase()}/${key}` : method.toUpperCase();
}
/** validate that the update and the existing value are compatible */
function checkCompatibilityWithExistingValue(value, existingValue) {
    if (!existingValue || !value) {
        return {
            isCompatible: true,
        };
    }
    const existingValueType = Array.isArray(existingValue) ? 'array' : 'non-array';
    const newValueType = Array.isArray(value) ? 'array' : 'non-array';
    if (existingValueType !== newValueType) {
        return {
            isCompatible: false,
            existingValueType,
            newValueType,
        };
    }
    return {
        isCompatible: true,
    };
}
/**
 * Filters an object based on a condition and an inclusion flag.
 *
 * @param obj - The object to filter.
 * @param condition - The condition to apply.
 * @param include - If true, include entries that match the condition; otherwise, exclude them.
 * @returns The filtered object.
 */
function filterObject(obj, condition, include) {
    const result = {};
    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        let shouldInclude;
        if (Array.isArray(condition)) {
            shouldInclude = condition.includes(key);
        }
        else if (typeof condition === 'string') {
            shouldInclude = key === condition;
        }
        else {
            shouldInclude = condition(entries[i]);
        }
        if (include ? shouldInclude : !shouldInclude) {
            result[key] = value;
        }
    }
    return result;
}
/**
 * Picks entries from an object based on a condition.
 *
 * @param obj - The object to pick entries from.
 * @param condition - The condition to determine which entries to pick.
 * @returns The object containing only the picked entries.
 */
function pick(obj, condition) {
    return filterObject(obj, condition, true);
}
/**
 * Omits entries from an object based on a condition.
 *
 * @param obj - The object to omit entries from.
 * @param condition - The condition to determine which entries to omit.
 * @returns The object containing only the remaining entries after omission.
 */
function omit(obj, condition) {
    return filterObject(obj, condition, false);
}
exports.default = { isEmptyObject, fastMerge, formatActionName, removeNestedNullValues, checkCompatibilityWithExistingValue, pick, omit };
