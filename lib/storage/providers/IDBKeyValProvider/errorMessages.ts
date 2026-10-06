/** Messages of errors thrown by the IndexedDB provider itself, matched by `classifyIDBError` as UNAVAILABLE. */
const IDBErrorMessage = {
    UNAVAILABLE: 'indexedDB is not available in this environment',
    HEAL_EXHAUSTED: 'IndexedDB heal budget exhausted',
} as const;

export default IDBErrorMessage;
