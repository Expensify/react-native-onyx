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
function isMergeableObject(value: unknown): boolean {
    const nonNullObject = value != null ? typeof value === 'object' : false;
    return nonNullObject && Object.prototype.toString.call(value) !== '[object RegExp]' && Object.prototype.toString.call(value) !== '[object Date]' && !Array.isArray(value);
}

/**
 * Merges the source object into the target object.
 * @param target - The target object.
 * @param source - The source object.
 * @param shouldRemoveNullObjectValues - If true, null object values will be removed.
 * @returns - The merged object.
 */
function mergeObject<TTarget extends unknown[] | Record<string, unknown>>(target: TTarget, source: TTarget, shouldRemoveNullObjectValues = true): TTarget {
    const destination: Record<string, unknown> = {};
    if (isMergeableObject(target)) {
        // lodash adds a small overhead so we don't use it here
        const targetKeys = Object.keys(target);
        for (let i = 0; i < targetKeys.length; ++i) {
            const key = targetKeys[i];
            const sourceValue = source?.[key as keyof TTarget];
            const targetValue = target?.[key as keyof TTarget];

            // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
            const isSourceOrTargetNull = targetValue === null || sourceValue === null;
            const shouldOmitSourceKey = shouldRemoveNullObjectValues && isSourceOrTargetNull;

            if (!shouldOmitSourceKey) {
                destination[key] = targetValue;
            }
        }
    }

    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; ++i) {
        const key = sourceKeys[i];
        const sourceValue = source?.[key as keyof TTarget];
        const targetValue = target?.[key as keyof TTarget];

        // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
        const shouldOmitSourceKey = shouldRemoveNullObjectValues && sourceValue === null;

        // If we pass undefined as the updated value for a key, we want to generally ignore it
        const isSourceKeyUndefined = sourceValue === undefined;

        if (!isSourceKeyUndefined && !shouldOmitSourceKey) {
            const isSourceKeyMergable = isMergeableObject(sourceValue);

            if (isSourceKeyMergable && targetValue) {
                // eslint-disable-next-line no-use-before-define
                destination[key] = fastMerge(targetValue, sourceValue as typeof targetValue, shouldRemoveNullObjectValues);
            } else if (!shouldRemoveNullObjectValues || sourceValue !== null) {
                destination[key] = sourceValue;
            }
        }
    }

    return destination as TTarget;
}

/**
 * Merges two objects and removes null values if "shouldRemoveNullObjectValues" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
function fastMerge<TTarget extends unknown[] | Record<string, unknown>>(target: TTarget, source: TTarget, shouldRemoveNullObjectValues = true): TTarget {
    // We have to ignore arrays and nullish values here,
    // otherwise "mergeObject" will throw an error,
    // because it expects an object as "source"
    if (Array.isArray(source) || source === null || source === undefined) {
        return source;
    }
    return mergeObject(target, source, shouldRemoveNullObjectValues);
}

/** Deep removes the nested null values from the given value. */
function removeNestedNullValues(value: unknown[] | Record<string, unknown>) {
    if (typeof value === 'object' && !Array.isArray(value)) {
        return fastMerge(value, value);
    }

    return value;
}

/** Formats the action name by uppercasing and adding the key if provided. */
function formatActionName(method: string, key?: OnyxKey): string {
    return key ? `${method.toUpperCase()}/${key}` : method.toUpperCase();
}

export default {isEmptyObject, fastMerge, formatActionName, removeNestedNullValues};
