/**
 * The message our own guards throw when the IndexedDB global is missing. `classifyIDBError` matches
 * it (alongside the browsers' own wordings) so a guarded failure classifies as UNAVAILABLE just like
 * an unguarded one would.
 */
const INDEXED_DB_UNAVAILABLE_MESSAGE = 'indexedDB is not available in this environment';

/**
 * Reports whether the IndexedDB engine exists in this environment.
 *
 * This is a `typeof` check rather than `indexedDB === undefined` on purpose: on WebKit (which backs
 * every browser on iOS, Chrome included) the global is genuinely *undeclared* in private tabs and in
 * Lockdown Mode, so reading it directly throws `ReferenceError: Can't find variable: indexedDB`
 * instead of evaluating to `undefined`. The extra null check covers embedders that declare the
 * global but leave it empty.
 */
function isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

export default isIndexedDBAvailable;
export {INDEXED_DB_UNAVAILABLE_MESSAGE};
