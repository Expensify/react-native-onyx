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

    // NitroSQLite 10.1 exposes native open failures even when their message differs
    // from SQLite's standard wording. Keep this classifier free of native imports.
    const hasDatabaseOpenError = typeof error === 'object' && error !== null && 'type' in error && error.type === 'DatabaseCannotBeOpened';
    if (hasDatabaseOpenError || message.includes('disk i/o error') || message.includes('unable to open database file')) {
        return StorageErrorClass.DISK_PRESSURE;
    }

    return StorageErrorClass.UNKNOWN;
}

export default classifySQLiteError;
