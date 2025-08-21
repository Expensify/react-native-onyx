import type {ConnectOptions, OnyxInput, OnyxKey} from './types';

type EmptyObject = Record<string, never>;
type EmptyValue = EmptyObject | null | undefined;

/**
 * A tuple where the first value is the path to the nested object that contains the
 * internal `ONYX_INTERNALS__REPLACE_OBJECT_MARK` flag, and the second value is the data we want to replace
 * in that path.
 *
 * This tuple will be used in SQLiteProvider to replace the nested object using `JSON_REPLACE`.
 * */
type FastMergeReplaceNullPatch = [string[], unknown];

type FastMergeOptions = {
    /** If true, null object values will be removed. */
    shouldRemoveNestedNulls?: boolean;

    /**
     * If set to "mark", we will mark objects that are set to null instead of simply removing them,
     * so that we can batch changes together, without losing information about the object removal.
     * If set to "replace", we will completely replace the marked objects with the new value instead of merging them.
     */
    objectRemovalMode?: 'mark' | 'replace' | 'none';
};

type FastMergeMetadata = {
    /** The list of tuples that will be used in SQLiteProvider to replace the nested objects using `JSON_REPLACE`. */
    replaceNullPatches: FastMergeReplaceNullPatch[];
};

type FastMergeResult<TValue> = {
    /** The result of the merge. */
    result: TValue;

    /** The list of tuples that will be used in SQLiteProvider to replace the nested objects using `JSON_REPLACE`. */
    replaceNullPatches: FastMergeReplaceNullPatch[];
};

const ONYX_INTERNALS__REPLACE_OBJECT_MARK = 'ONYX_INTERNALS__REPLACE_OBJECT_MARK';

/**
 * Merges two objects and removes null values if "shouldRemoveNestedNulls" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 */
function fastMerge<TValue>(target: TValue, source: TValue, options?: FastMergeOptions, metadata?: FastMergeMetadata, basePath: string[] = []): FastMergeResult<TValue> {
    if (!metadata) {
        // eslint-disable-next-line no-param-reassign
        metadata = {
            replaceNullPatches: [],
        };
    }

    // We have to ignore arrays and nullish values here,
    // otherwise "mergeObject" will throw an error,
    // because it expects an object as "source"
    if (Array.isArray(source) || source === null || source === undefined) {
        return {result: source, replaceNullPatches: metadata.replaceNullPatches};
    }

    const optionsWithDefaults: FastMergeOptions = {
        shouldRemoveNestedNulls: options?.shouldRemoveNestedNulls ?? false,
        objectRemovalMode: options?.objectRemovalMode ?? 'none',
    };

    const mergedValue = mergeObject(target, source as Record<string, unknown>, optionsWithDefaults, metadata, basePath) as TValue;

    return {result: mergedValue, replaceNullPatches: metadata.replaceNullPatches};
}

/**
 * Merges the source object into the target object.
 * @param target - The target object.
 * @param source - The source object.
 * @param options - The options for the merge.
 * @param metadata - The metadata for the merge.
 * @param basePath - The base path for the merge.
 * @returns - The merged object.
 */
function mergeObject<TObject extends Record<string, unknown>>(
    target: TObject | unknown | null | undefined,
    source: TObject,
    options: FastMergeOptions,
    metadata: FastMergeMetadata,
    basePath: string[],
): TObject {
    const destination: Record<string, unknown> = {};

    const targetObject = isMergeableObject(target) ? target : undefined;

    // First we want to copy over all keys from the target into the destination object,
    // in case "target" is a mergable object.
    // If "shouldRemoveNestedNulls" is true, we want to remove null values from the merged object
    // and therefore we need to omit keys where either the source or target value is null.
    if (targetObject) {
        Object.keys(targetObject).forEach((key) => {
            const targetProperty = targetObject?.[key];
            const sourceProperty = source?.[key];

            // If "shouldRemoveNestedNulls" is true, we want to remove (nested) null values from the merged object.
            // If either the source or target value is null, we want to omit the key from the merged object.
            const shouldOmitNullishProperty = options.shouldRemoveNestedNulls && (targetProperty === null || sourceProperty === null);

            if (targetProperty === undefined || shouldOmitNullishProperty) {
                return;
            }

            destination[key] = targetProperty;
        });
    }

    // After copying over all keys from the target object, we want to merge the source object into the destination object.
    Object.keys(source).forEach((key) => {
        let targetProperty = targetObject?.[key];
        const sourceProperty = source?.[key] as Record<string, unknown>;

        // If "shouldRemoveNestedNulls" is true, we want to remove (nested) null values from the merged object.
        // If the source value is null, we want to omit the key from the merged object.
        const shouldOmitNullishProperty = options.shouldRemoveNestedNulls && sourceProperty === null;

        if (sourceProperty === undefined || shouldOmitNullishProperty) {
            return;
        }

        // If the source value is not a mergable object, we need to set the key directly.
        if (!isMergeableObject(sourceProperty)) {
            destination[key] = sourceProperty;
            return;
        }

        // If "shouldMarkRemovedObjects" is enabled and the previous merge change (targetProperty) is null,
        // it means we want to fully replace this object when merging the batched changes with the Onyx value.
        // To achieve this, we first mark these nested objects with an internal flag.
        // When calling fastMerge again with "mark" removal mode, the marked objects will be removed.
        if (options.objectRemovalMode === 'mark' && targetProperty === null) {
            targetProperty = {[ONYX_INTERNALS__REPLACE_OBJECT_MARK]: true};
            metadata.replaceNullPatches.push([[...basePath, key], {...sourceProperty}]);
        }

        // Later, when merging the batched changes with the Onyx value, if a nested object of the batched changes
        // has the internal flag set, we replace the entire destination object with the source one and remove
        // the flag.
        if (options.objectRemovalMode === 'replace' && sourceProperty[ONYX_INTERNALS__REPLACE_OBJECT_MARK]) {
            // We do a spread here in order to have a new object reference and allow us to delete the internal flag
            // of the merged object only.
            const sourcePropertyWithoutMark = {...sourceProperty};
            delete sourcePropertyWithoutMark.ONYX_INTERNALS__REPLACE_OBJECT_MARK;
            destination[key] = sourcePropertyWithoutMark;
            return;
        }

        destination[key] = fastMerge(targetProperty, sourceProperty, options, metadata, [...basePath, key]).result;
    });

    return destination as TObject;
}

/** Checks whether the given object is an object and not null/undefined. */
function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue {
    return typeof obj === 'object' && Object.keys(obj || {}).length === 0;
}

/**
 * Checks whether the given value can be merged. It has to be an object, but not an array, RegExp or Date.
 * Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1.
 */
function isMergeableObject<TObject extends Record<string, unknown>>(value: unknown): value is TObject {
    const isNonNullObject = value != null ? typeof value === 'object' : false;
    return isNonNullObject && !(value instanceof RegExp) && !(value instanceof Date) && !Array.isArray(value);
}

/** Deep removes the nested null values from the given value. */
function removeNestedNullValues<TValue extends OnyxInput<OnyxKey> | null>(value: TValue): TValue {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return [...value] as TValue;
    }

    const result: Record<string, unknown> = {};

    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
        const propertyValue = value[key];

        if (propertyValue === null || propertyValue === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }

        if (typeof propertyValue === 'object' && !Array.isArray(propertyValue)) {
            const valueWithoutNestedNulls = removeNestedNullValues(propertyValue);
            result[key] = valueWithoutNestedNulls;
        } else {
            result[key] = propertyValue;
        }
    }

    return result as TValue;
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

/**
 * Filters an object based on a condition and an inclusion flag.
 *
 * @param obj - The object to filter.
 * @param condition - The condition to apply.
 * @param include - If true, include entries that match the condition; otherwise, exclude them.
 * @returns The filtered object.
 */
function filterObject<TValue>(obj: Record<string, TValue>, condition: string | string[] | ((entry: [string, TValue]) => boolean), include: boolean): Record<string, TValue> {
    const result: Record<string, TValue> = {};
    const entries = Object.entries(obj);

    for (const [key, value] of entries) {
        let shouldInclude: boolean;

        if (Array.isArray(condition)) {
            shouldInclude = condition.includes(key);
        } else if (typeof condition === 'string') {
            shouldInclude = key === condition;
        } else {
            shouldInclude = condition([key, value]);
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
function pick<TValue>(obj: Record<string, TValue>, condition: string | string[] | ((entry: [string, TValue]) => boolean)): Record<string, TValue> {
    return filterObject(obj, condition, true);
}

/**
 * Omits entries from an object based on a condition.
 *
 * @param obj - The object to omit entries from.
 * @param condition - The condition to determine which entries to omit.
 * @returns The object containing only the remaining entries after omission.
 */
function omit<TValue>(obj: Record<string, TValue>, condition: string | string[] | ((entry: [string, TValue]) => boolean)): Record<string, TValue> {
    return filterObject(obj, condition, false);
}

/**
 * Whether the connect options has the `withOnyxInstance` property defined, that is, it's used by the `withOnyx()` HOC.
 */
function hasWithOnyxInstance<TKey extends OnyxKey>(mapping: ConnectOptions<TKey>) {
    return 'withOnyxInstance' in mapping && mapping.withOnyxInstance;
}

export default {
    fastMerge,
    isEmptyObject,
    formatActionName,
    removeNestedNullValues,
    checkCompatibilityWithExistingValue,
    pick,
    omit,
    hasWithOnyxInstance,
    ONYX_INTERNALS__REPLACE_OBJECT_MARK,
};
export type {FastMergeResult, FastMergeReplaceNullPatch, FastMergeOptions};
