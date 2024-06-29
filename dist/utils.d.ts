import type { OnyxInput, OnyxKey } from './types';
type EmptyObject = Record<string, never>;
type EmptyValue = EmptyObject | null | undefined;
/** Checks whether the given object is an object and not null/undefined. */
declare function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue;
/**
 * Merges two objects and removes null values if "shouldRemoveNestedNulls" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
declare function fastMerge<TValue>(target: TValue, source: TValue, shouldRemoveNestedNulls?: boolean): TValue;
/** Deep removes the nested null values from the given value. */
declare function removeNestedNullValues<TValue extends OnyxInput<OnyxKey> | null>(value: TValue): TValue;
/** Formats the action name by uppercasing and adding the key if provided. */
declare function formatActionName(method: string, key?: OnyxKey): string;
/** validate that the update and the existing value are compatible */
declare function checkCompatibilityWithExistingValue(value: unknown, existingValue: unknown): {
    isCompatible: boolean;
    existingValueType?: string;
    newValueType?: string;
};
/**
 * Picks entries from an object based on a condition.
 *
 * @param obj - The object to pick entries from.
 * @param condition - The condition to determine which entries to pick.
 * @returns The object containing only the picked entries.
 */
declare function pick<TValue>(obj: Record<string, TValue>, condition: string | string[] | ((entry: [string, TValue]) => boolean)): Record<string, TValue>;
/**
 * Omits entries from an object based on a condition.
 *
 * @param obj - The object to omit entries from.
 * @param condition - The condition to determine which entries to omit.
 * @returns The object containing only the remaining entries after omission.
 */
declare function omit<TValue>(obj: Record<string, TValue>, condition: string | string[] | ((entry: [string, TValue]) => boolean)): Record<string, TValue>;
declare const _default: {
    isEmptyObject: typeof isEmptyObject;
    fastMerge: typeof fastMerge;
    formatActionName: typeof formatActionName;
    removeNestedNullValues: typeof removeNestedNullValues;
    checkCompatibilityWithExistingValue: typeof checkCompatibilityWithExistingValue;
    pick: typeof pick;
    omit: typeof omit;
};
export default _default;
