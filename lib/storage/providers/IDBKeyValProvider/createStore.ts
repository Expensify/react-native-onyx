import * as IDB from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import * as Logger from '../../../Logger';

/**
 * Attempts to heal a corrupted IDB by deleting the database entirely.
 * On success the next `indexedDB.open()` will recreate it from scratch.
 */
function healCorruptedDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => {
            Logger.logInfo('IDB database deleted successfully, will recreate on next operation', {dbName});
            resolve();
        };
        request.onerror = () => {
            Logger.logAlert('IDB deleteDatabase failed, corruption is unrecoverable', {dbName});
            reject(request.error ?? new DOMException('Failed to delete corrupted database', 'UnknownError'));
        };
        request.onblocked = () => {
            Logger.logAlert('IDB deleteDatabase blocked by other connections', {dbName});
            reject(new DOMException('deleteDatabase blocked', 'UnknownError'));
        };
    });
}

// This is a copy of the createStore function from idb-keyval, we need a custom implementation
// because we need to create the database manually in order to ensure that the store exists before we use it.
// If the store does not exist, idb-keyval will throw an error
// source: https://github.com/jakearchibald/idb-keyval/blob/9d19315b4a83897df1e0193dccdc29f78466a0f3/src/index.ts#L12
function createStore(dbName: string, storeName: string): UseStore {
    let dbp: Promise<IDBDatabase> | undefined;

    const attachHandlers = (db: IDBDatabase) => {
        // Browsers may close idle IDB connections at any time, especially Safari.
        // We clear the cached promise so the next operation opens a fresh connection.
        // https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/close_event
        // eslint-disable-next-line no-param-reassign
        db.onclose = () => {
            Logger.logInfo('IDB connection closed by browser', {dbName, storeName});
            dbp = undefined;
        };

        // When another tab triggers a DB version upgrade, we must close the connection
        // to unblock the upgrade; otherwise the other tab's open request hangs indefinitely.
        // https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event
        // eslint-disable-next-line no-param-reassign
        db.onversionchange = () => {
            Logger.logInfo('IDB connection closing due to version change', {dbName, storeName});
            db.close();
            dbp = undefined;
        };
    };

    const getDB = () => {
        if (dbp) return dbp;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        dbp = IDB.promisifyRequest(request);

        dbp.then(attachHandlers, () => {
            // Clear the cached rejected promise so the next operation retries
            // with a fresh indexedDB.open() instead of returning the same rejection.
            dbp = undefined;
        });
        return dbp;
    };

    // Ensures the store exists in the DB. If missing, bumps the version to trigger
    // onupgradeneeded, recreates the store, and returns a promise to the new DB.
    const verifyStoreExists = (db: IDBDatabase) => {
        if (db.objectStoreNames.contains(storeName)) {
            return db;
        }

        Logger.logInfo(`Store ${storeName} does not exist in database ${dbName}.`);
        const nextVersion = db.version + 1;
        db.close();

        const request = indexedDB.open(dbName, nextVersion);
        request.onupgradeneeded = () => {
            const updatedDatabase = request.result;
            if (updatedDatabase.objectStoreNames.contains(storeName)) {
                return;
            }

            Logger.logInfo(`Creating store ${storeName} in database ${dbName}.`);
            updatedDatabase.createObjectStore(storeName);
        };

        dbp = IDB.promisifyRequest(request);
        dbp.then(attachHandlers, () => {
            dbp = undefined;
        });
        return dbp;
    };

    function executeTransaction<T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>): Promise<T> {
        return getDB()
            .then(verifyStoreExists)
            .then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
    }

    // If the connection was closed between getDB() resolving and db.transaction() executing,
    // the transaction throws InvalidStateError. We catch it and retry once with a fresh connection.
    //
    // If the LevelDB backing store is corrupted (Chromium-specific), we attempt to heal by
    // deleting the database and retrying. If healing fails, the error propagates up to
    // tryOrDegradePerformance which falls back to MemoryOnlyProvider.
    return (txMode, callback) =>
        executeTransaction(txMode, callback).catch((error) => {
            if (error instanceof DOMException && error.name === 'InvalidStateError') {
                Logger.logAlert('IDB InvalidStateError, retrying with fresh connection', {
                    dbName,
                    storeName,
                    txMode,
                    errorMessage: error.message,
                });
                dbp = undefined;
                // Retry only once — this call is not wrapped, so if it also fails the error propagates normally.
                return executeTransaction(txMode, callback);
            }

            if (error instanceof DOMException && error.message.includes('Internal error opening backing store')) {
                Logger.logAlert('IDB backing store corrupted, attempting to heal', {
                    dbName,
                    storeName,
                    errorMessage: error.message,
                });
                dbp = undefined;
                return healCorruptedDatabase(dbName).then(() => executeTransaction(txMode, callback));
            }

            throw error;
        });
}

export default createStore;
