/* eslint-disable @typescript-eslint/prefer-for-of */

import type {OnyxKey} from './types';

type EmptyObject = Record<string, never>;
type EmptyValue = EmptyObject | null | undefined;

/** Checks whether the given object is an object and not null/undefined. */
function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue {
    return typeof obj === 'object' && Object.keys(obj || {}).length === 0;
}

// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

/**
 * Checks whether the given value can be merged. It has to be an object, but not an array, RegExp or Date.
 */
function isMergeableObject(value: unknown): value is Record<string, unknown> {
    const isNonNullObject = value != null ? typeof value === 'object' : false;
    return isNonNullObject && Object.prototype.toString.call(value) !== '[object RegExp]' && Object.prototype.toString.call(value) !== '[object Date]' && !Array.isArray(value);
}

/**
 * Merges the source object into the target object.
 * @param target - The target object.
 * @param source - The source object.
 * @param shouldRemoveNestedNulls - If true, null object values will be removed.
 * @returns - The merged object.
 */
function mergeObject<TObject extends Record<string, unknown>>(target: TObject | null, source: TObject, shouldRemoveNestedNulls = true): TObject {
    const destination: Record<string, unknown> = {};

    // First we want to copy over all keys from the target into the destination object,
    // in case "target" is a mergable object.
    // If "shouldRemoveNestedNulls" is true, we want to remove null values from the merged object
    // and therefore we need to omit keys where either the source or target value is null.
    if (isMergeableObject(target)) {
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];
            const sourceValue = source?.[key];
            const targetValue = target?.[key];

            // If "shouldRemoveNestedNulls" is true, we want to remove null values from the merged object.
            // Therefore, if either target or source value is null, we want to prevent the key from being set.
            const isSourceOrTargetNull = targetValue === null || sourceValue === null;
            const shouldOmitTargetKey = shouldRemoveNestedNulls && isSourceOrTargetNull;

            if (!shouldOmitTargetKey) {
                destination[key] = targetValue;
            }
        }
    }

    // After copying over all keys from the target object, we want to merge the source object into the destination object.
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];
        const sourceValue = source?.[key];
        const targetValue = target?.[key];

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
                const targetValueWithFallback = (targetValue ?? {}) as TObject;
                destination[key] = fastMerge(targetValueWithFallback, sourceValue, shouldRemoveNestedNulls);
            } else {
                destination[key] = sourceValue;
            }
        }
    }

    return destination as TObject;
}

/**
 * Merges two objects and removes null values if "shouldRemoveNestedNulls" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
function fastMerge<TObject extends Record<string, unknown>>(target: TObject | null, source: TObject | null, shouldRemoveNestedNulls = true): TObject | null {
    // We have to ignore arrays and nullish values here,
    // otherwise "mergeObject" will throw an error,
    // because it expects an object as "source"
    if (Array.isArray(source) || source === null || source === undefined) {
        return source;
    }

    return mergeObject(target, source, shouldRemoveNestedNulls);
}

/** Deep removes the nested null values from the given value. */
function removeNestedNullValues<TObject extends Record<string, unknown>>(value: unknown | unknown[] | TObject): Record<string, unknown> | unknown[] | null {
    if (typeof value === 'object' && !Array.isArray(value)) {
        return fastMerge(value as Record<string, unknown> | null, value as Record<string, unknown> | null);
    }

    return value as Record<string, unknown> | null;
}

/** Formats the action name by uppercasing and adding the key if provided. */
function formatActionName(method: string, key?: OnyxKey): string {
    return key ? `${method.toUpperCase()}/${key}` : method.toUpperCase();
}

/** validate that the update and the existing value are compatible */
function checkCompatibilityWithExistingValue(value: unknown, existingValue: unknown): {isCompatible: boolean; existingValueType?: string; newValueType?: string} {
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

export default {isEmptyObject, fastMerge, formatActionName, removeNestedNullValues, checkCompatibilityWithExistingValue};
