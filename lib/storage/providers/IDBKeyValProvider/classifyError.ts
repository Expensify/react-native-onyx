import type {ValueOf} from 'type-fest';
import {StorageErrorClass, getErrorParts} from '../../errors';
import {INDEXED_DB_UNAVAILABLE_MESSAGE} from './isIndexedDBAvailable';

/**
 * Classifies an IndexedDB write failure into the shared storage taxonomy (lib/storage/errors.ts).
 * Matching is done on the lowercased error name and message. This is the IndexedDB engine's own
 * dialect — it is NOT shared with other engines.
 */
function classifyIDBError(error: unknown): ValueOf<typeof StorageErrorClass> {
    const {name, message} = getErrorParts(error);

    // The engine is absent, not broken.
    if (message.includes("can't find variable: indexeddb") || message.includes('indexeddb is not defined') || message.includes(INDEXED_DB_UNAVAILABLE_MESSAGE.toLowerCase())) {
        return StorageErrorClass.UNAVAILABLE;
    }

    // Non-serializable data passed to IDBObjectStore.put — retrying is futile.
    if (message.includes("failed to execute 'put' on 'idbobjectstore'")) {
        return StorageErrorClass.INVALID_DATA;
    }

    // A queued File/Blob whose backing bytes are gone — the source OS file was modified, deleted, or
    // renamed after being picked, so the structured clone fails at write time. Chromium reports it as
    // InvalidBlob (Windows) or IOError (macOS). Retrying re-reads the same dead blob and can never succeed.
    if (message.includes('failed to write blobs')) {
        return StorageErrorClass.INVALID_DATA;
    }

    // Browser quota exceeded.
    if (name.includes('quotaexceedederror') || message.includes('quotaexceedederror')) {
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
        message.includes('without an in-progress transaction') ||
        message.includes('idb write transaction aborted without an error')
    ) {
        return StorageErrorClass.TRANSIENT;
    }

    return StorageErrorClass.UNKNOWN;
}

export default classifyIDBError;
