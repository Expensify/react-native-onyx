import type {ValueOf} from 'type-fest';

/**
 * Single source of truth for classifying storage (IndexedDB / SQLite) write failures.
 *
 * Both layers that react to storage errors consult this:
 * - the connection layer (`createStore`) recovers TRANSIENT and FATAL errors by reopening the DB, and
 * - the operation layer (`OnyxUtils.retryOperation`) recovers CAPACITY by eviction and retries UNKNOWN.
 *
 * Keeping the matchers here (instead of duplicated string lists in each layer) guarantees the two
 * layers agree on what an error *is*, even though they react to it differently. This module has no
 * Onyx dependencies so it can live in the storage layer without creating an import cycle.
 */
const StorageErrorClass = {
    /** Connection/transport failure (stale connection). Owner: connection layer — reopen + retry once. */
    TRANSIENT: 'transient',
    /** Quota exceeded / disk full. Owner: operation layer — evict and retry. */
    CAPACITY: 'capacity',
    /** Non-serializable payload. Never retriable — the same data will always fail. */
    INVALID_DATA: 'invalidData',
    /** Backing-store corruption. Owner: connection layer — budgeted heal, then give up. */
    FATAL: 'fatal',
    /** Unmatched. Owner: operation layer — bounded retry. */
    UNKNOWN: 'unknown',
} as const;

type StorageErrorClassValue = ValueOf<typeof StorageErrorClass>;

function getErrorParts(error: unknown): {name: string; message: string} {
    if (error instanceof Error || error instanceof DOMException) {
        return {name: (error.name ?? '').toLowerCase(), message: (error.message ?? '').toLowerCase()};
    }
    return {name: '', message: String(error ?? '').toLowerCase()};
}

/**
 * Classifies a storage write error into one of the {@link StorageErrorClass} buckets.
 * Matching is done on the lowercased error name and message.
 */
function classifyStorageError(error: unknown): StorageErrorClassValue {
    const {name, message} = getErrorParts(error);

    // Non-serializable data passed to IDBObjectStore.put — retrying is futile.
    if (message.includes("failed to execute 'put' on 'idbobjectstore'")) {
        return StorageErrorClass.INVALID_DATA;
    }

    // Storage capacity: browser quota exceeded (IDB) or device disk full (SQLite).
    if (name.includes('quotaexceedederror') || message.includes('quotaexceedederror') || message.includes('database or disk is full')) {
        return StorageErrorClass.CAPACITY;
    }

    // Backing-store corruption (Chromium LevelDB). Recoverable only via a budgeted reopen.
    if (message.includes('internal error opening backing store')) {
        return StorageErrorClass.FATAL;
    }

    // Transient connection/transport failures — the cached connection is stale and a reopen fixes it:
    // - InvalidStateError: connection closed between getDB() resolving and db.transaction().
    // - AbortError: write transaction aborted (connection close / versionchange / sibling abort).
    // - Safari/WebKit IDB server termination for backgrounded tabs.
    if (
        name.includes('invalidstateerror') ||
        name.includes('aborterror') ||
        message.includes('connection to indexed database server lost') ||
        message.includes('connection is closing') ||
        // This is related to https://github.com/Expensify/react-native-onyx/pull/796 — remove this comment when #796 is merged.
        message.includes('idb write transaction aborted without an error')
    ) {
        return StorageErrorClass.TRANSIENT;
    }

    return StorageErrorClass.UNKNOWN;
}

export {StorageErrorClass, classifyStorageError};
export type {StorageErrorClassValue};
