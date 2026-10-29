import {NitroSQLiteError, NitroSQLiteExceptionType} from 'react-native-nitro-sqlite/errors';
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
        // FATAL heal budget spent.
        [Object.assign(new Error('IndexedDB heal budget exhausted: Internal error.'), {name: 'IDBHealExhaustedError'}), StorageErrorClass.UNAVAILABLE],
        [new Error('IndexedDB heal budget exhausted: Internal error.'), StorageErrorClass.UNKNOWN],
        // Anything else stays UNKNOWN.
        [new Error('some brand new failure'), StorageErrorClass.UNKNOWN],
    ])('classifies %s as %s', (error, expectedClass) => {
        expect(classifyIDBError(error)).toBe(expectedClass);
    });
});

describe('classifySQLiteError', () => {
    it.each([
        [new Error('database or disk is full'), StorageErrorClass.CAPACITY],
        [new Error(`[NativeNitroSQLiteException][${NitroSQLiteExceptionType.SqlExecutionError}] database or disk is full`), StorageErrorClass.CAPACITY],
        [new Error('disk I/O error'), StorageErrorClass.DISK_PRESSURE],
        [new Error('unable to open database file'), StorageErrorClass.DISK_PRESSURE],
        [new NitroSQLiteError(`[NativeNitroSQLiteException][${NitroSQLiteExceptionType.DatabaseCannotBeOpened}] Cannot create the database`), StorageErrorClass.UNAVAILABLE],
        [new NitroSQLiteError(`[NativeNitroSQLiteException][${NitroSQLiteExceptionType.DatabaseCannotBeOpened}] database or disk is full`), StorageErrorClass.UNAVAILABLE],
        [{type: NitroSQLiteExceptionType.DatabaseCannotBeOpened, message: 'Permission denied'}, StorageErrorClass.UNAVAILABLE],
        // Encryption configuration and closed-connection errors do not mean that storage is unavailable.
        [{type: NitroSQLiteExceptionType.EncryptionNotEnabled, message: 'SEE is not enabled'}, StorageErrorClass.UNKNOWN],
        [{type: NitroSQLiteExceptionType.DatabaseCannotBeDecrypted, message: 'Wrong key'}, StorageErrorClass.UNKNOWN],
        [{type: NitroSQLiteExceptionType.DatabaseNotOpen, message: 'Database is closed'}, StorageErrorClass.UNKNOWN],
        [new Error('some brand new failure'), StorageErrorClass.UNKNOWN],
        [{type: null}, StorageErrorClass.UNKNOWN],
        ['DatabaseCannotBeOpened', StorageErrorClass.UNKNOWN],
        [null, StorageErrorClass.UNKNOWN],
        [undefined, StorageErrorClass.UNKNOWN],
    ])('classifies %s as %s', (error, expectedClass) => {
        // Given either a structured native error or a legacy SQLite message.
        // When classifying without initializing the native module.
        const errorClass = classifySQLiteError(error);

        // Then native open failures use memory storage, while write failures retain their recovery class.
        expect(errorClass).toBe(expectedClass);
    });
});
