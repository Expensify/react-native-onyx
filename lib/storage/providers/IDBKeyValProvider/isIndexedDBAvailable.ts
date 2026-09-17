/** Matched by `classifyIDBError` so a guarded failure classifies as UNAVAILABLE like an unguarded one. */
const INDEXED_DB_UNAVAILABLE_MESSAGE = 'indexedDB is not available in this environment';

/**
 * `typeof` instead of `indexedDB === undefined`: on WebKit the global is undeclared in private tabs and
 * Lockdown Mode, so reading it throws a `ReferenceError` instead of evaluating to `undefined`.
 */
function isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

export default isIndexedDBAvailable;
export {INDEXED_DB_UNAVAILABLE_MESSAGE};
