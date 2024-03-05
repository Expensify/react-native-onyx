import type { OnyxKey } from './types';
type EmptyObject = Record<string, never>;
type EmptyValue = EmptyObject | null | undefined;
/** Checks whether the given object is an object and not null/undefined. */
declare function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue;
/**
 * Merges two objects and removes null values if "shouldRemoveNullObjectValues" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
declare function fastMerge<TTarget extends unknown[] | Record<string, unknown>>(target: TTarget, source: TTarget, shouldRemoveNullObjectValues?: boolean): TTarget;
/** Deep removes the nested null values from the given value. */
declare function removeNestedNullValues(value: unknown[] | Record<string, unknown>): Record<string, unknown> | unknown[];
/** Formats the action name by uppercasing and adding the key if provided. */
declare function formatActionName(method: string, key?: OnyxKey): string;
declare const _default: {
    isEmptyObject: typeof isEmptyObject;
    fastMerge: typeof fastMerge;
    formatActionName: typeof formatActionName;
    removeNestedNullValues: typeof removeNestedNullValues;
};
export default _default;
