import classifyIDBError from '../../../../lib/storage/providers/IDBKeyValProvider/classifyError';
import classifySQLiteError from '../../../../lib/storage/providers/classifySQLiteError';
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
        [new DOMException('Internal error.', 'UnknownError'), StorageErrorClass.FATAL],
        [new DOMException('Internal error.', 'SyntaxError'), StorageErrorClass.UNKNOWN],
        // Transient connection failures.
        [new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError'), StorageErrorClass.TRANSIENT],
        [new DOMException('IDB write transaction aborted without an error', 'AbortError'), StorageErrorClass.TRANSIENT],
        // No IndexedDB engine at all — the three wordings we can receive.
        [new ReferenceError("Can't find variable: indexedDB"), StorageErrorClass.UNAVAILABLE],
        [new ReferenceError('indexedDB is not defined'), StorageErrorClass.UNAVAILABLE],
        [new Error('indexedDB is not available in this environment'), StorageErrorClass.UNAVAILABLE],
        // Anything else stays UNKNOWN.
        [new Error('some brand new failure'), StorageErrorClass.UNKNOWN],
    ])('classifies %s as %s', (error, expectedClass) => {
        expect(classifyIDBError(error)).toBe(expectedClass);
    });
});

describe('classifySQLiteError', () => {
    it.each([
        [new Error('database or disk is full'), StorageErrorClass.CAPACITY],
        [new Error('[NativeNitroSQLiteException][SqlExecutionError] database or disk is full'), StorageErrorClass.CAPACITY],
        [new Error('disk I/O error'), StorageErrorClass.DISK_PRESSURE],
        [new Error('unable to open database file'), StorageErrorClass.DISK_PRESSURE],
        [Object.assign(new Error('Cannot create the database'), {type: 'DatabaseCannotBeOpened'}), StorageErrorClass.DISK_PRESSURE],
        [{type: 'DatabaseCannotBeOpened', message: 'Permission denied'}, StorageErrorClass.DISK_PRESSURE],
        // Encryption configuration and closed-connection errors do not mean that storage is unavailable.
        [{type: 'EncryptionNotEnabled', message: 'SEE is not enabled'}, StorageErrorClass.UNKNOWN],
        [{type: 'DatabaseCannotBeDecrypted', message: 'Wrong key'}, StorageErrorClass.UNKNOWN],
        [{type: 'DatabaseNotOpen', message: 'Database is closed'}, StorageErrorClass.UNKNOWN],
        [new Error('some brand new failure'), StorageErrorClass.UNKNOWN],
        [null, StorageErrorClass.UNKNOWN],
        [undefined, StorageErrorClass.UNKNOWN],
    ])('classifies %s as %s', (error, expectedClass) => {
        // Given either a structured native error or a legacy SQLite message.
        // When classifying without loading the optional native dependency.
        const errorClass = classifySQLiteError(error);

        // Then native open failures share the existing disk-pressure recovery behavior.
        expect(errorClass).toBe(expectedClass);
    });
});
