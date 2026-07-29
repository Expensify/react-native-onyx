import type {ValueOf} from 'type-fest';
import {StorageErrorClass, getErrorParts} from '../errors';

/**
 * Classifies a SQLite write failure into the shared storage taxonomy (lib/storage/errors.ts).
 * This is the SQLite engine's own dialect — it is NOT shared with other engines. It lives in a
 * standalone module (no `react-native-nitro-sqlite` import) so it can be reused without pulling in
 * native dependencies.
 *
 * SQLite surfaces fewer distinct write-failure shapes than IndexedDB. As telemetry from the UNKNOWN
 * bucket (see OnyxUtils.retryOperation) reveals recurring native errors, add matchers here.
 */
function classifySQLiteError(error: unknown): ValueOf<typeof StorageErrorClass> {
    const {message} = getErrorParts(error);

    // Device disk full.
    if (message.includes('database or disk is full')) {
        return StorageErrorClass.CAPACITY;
    }

    // Filesystem-level failures around the database files, seen when the device disk is (nearly) full.
    // "disk I/O error" (SQLITE_IOERR) fires on every operation — reads included — after SQLite fails to
    // size the -shm file while (re)opening the database on a full disk; "unable to open database file"
    // (SQLITE_CANTOPEN) when the -shm file cannot be created at all; "cannot rollback" is a batch-write
    // failure whose original error was masked by the ROLLBACK itself failing on the same full disk.
    if (message.includes('disk i/o error') || message.includes('unable to open database file') || message.includes('cannot rollback - no transaction is active')) {
        return StorageErrorClass.DISK_PRESSURE;
    }

    return StorageErrorClass.UNKNOWN;
}

export default classifySQLiteError;
