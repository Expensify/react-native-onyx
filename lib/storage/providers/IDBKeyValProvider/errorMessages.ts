/** Messages of errors thrown by the IndexedDB provider itself. `classifyIDBError` maps both to `StorageErrorClass.UNAVAILABLE`. */
const IDBErrorMessage = {
    UNAVAILABLE: 'IndexedDB is not available in this environment',
    HEAL_EXHAUSTED: 'IndexedDB heal budget exhausted',
} as const;

export default IDBErrorMessage;
