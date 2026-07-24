import classifyIDBError from '../../../../lib/storage/providers/IDBKeyValProvider/classifyError';
import {StorageErrorClass} from '../../../../lib/storage/errors';

describe('classifyIDBError', () => {
    it.each([
        // Dead File/Blob in the payload — the platform-specific dialects of "Failed to write blobs".
        [new DOMException('Failed to write blobs (InvalidBlob)', 'DataError'), StorageErrorClass.INVALID_DATA],
        [new DOMException('Failed to write blobs (IOError)', 'DataError'), StorageErrorClass.INVALID_DATA],
        // Non-serializable payload.
        [new TypeError("Failed to execute 'put' on 'IDBObjectStore': something could not be cloned."), StorageErrorClass.INVALID_DATA],
        // Quota.
        [new DOMException('The quota has been exceeded.', 'QuotaExceededError'), StorageErrorClass.CAPACITY],
        // Backing-store corruption.
        [new DOMException('Internal error opening backing store for indexedDB.open.', 'UnknownError'), StorageErrorClass.FATAL],
        // Transient connection failures.
        [new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError'), StorageErrorClass.TRANSIENT],
        [new DOMException('IDB write transaction aborted without an error', 'AbortError'), StorageErrorClass.TRANSIENT],
        // Anything else stays UNKNOWN.
        [new Error('some brand new failure'), StorageErrorClass.UNKNOWN],
    ])('classifies %s as %s', (error, expectedClass) => {
        expect(classifyIDBError(error)).toBe(expectedClass);
    });
});
