/** Messages of errors thrown by the IndexedDB provider itself. `classifyIDBError` maps `UNAVAILABLE` to `StorageErrorClass.UNAVAILABLE`. */
const IDBErrorMessage = {
    UNAVAILABLE: 'IndexedDB is not available in this environment',
    HEAL_EXHAUSTED: 'IndexedDB heal budget exhausted',
} as const;

/** Names of errors thrown by the IndexedDB provider itself. `classifyIDBError` maps `HEAL_EXHAUSTED` to `StorageErrorClass.UNAVAILABLE`. */
const IDBErrorName = {
    HEAL_EXHAUSTED: 'IDBHealExhaustedError',
} as const;

export default IDBErrorMessage;
export {IDBErrorName};
