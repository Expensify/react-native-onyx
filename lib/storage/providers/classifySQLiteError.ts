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

    // Full-disk failures around the database files: SQLITE_IOERR (cannot size the -shm file on reopen,
    // fails reads too), SQLITE_CANTOPEN (cannot create it), and a failed ROLLBACK masking the original
    // write error. None can succeed until the OS frees space.
    if (message.includes('disk i/o error') || message.includes('unable to open database file') || message.includes('cannot rollback - no transaction is active')) {
        return StorageErrorClass.DISK_PRESSURE;
    }

    return StorageErrorClass.UNKNOWN;
}

export default classifySQLiteError;
