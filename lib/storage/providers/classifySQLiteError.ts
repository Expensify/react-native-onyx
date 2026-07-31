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

    return StorageErrorClass.UNKNOWN;
}

export default classifySQLiteError;
