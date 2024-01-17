import { OnyxKey } from './types';

/**
 * Merges two objects and removes null values if "shouldRemoveNullObjectValues" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 */
declare function fastMerge<T>(target: T, source: T, shouldRemoveNullObjectValues: boolean = true): T;

/**
 * Returns a formatted action name to be send to DevTools, given the method and optionally the key that was changed
 */
declare function formatActionName(method: string, key?: OnyxKey): string;

export default { fastMerge, formatActionName };
