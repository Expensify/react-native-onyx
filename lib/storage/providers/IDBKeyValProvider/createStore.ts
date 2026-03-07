import * as IDB from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import {logAlert, logInfo} from '../../../Logger';

// This is a copy of the createStore function from idb-keyval, we need a custom implementation
// because we need to create the database manually in order to ensure that the store exists before we use it.
// If the store does not exist, idb-keyval will throw an error
// source: https://github.com/jakearchibald/idb-keyval/blob/9d19315b4a83897df1e0193dccdc29f78466a0f3/src/index.ts#L12
function createStore(dbName: string, storeName: string): UseStore {
    let dbp: Promise<IDBDatabase> | undefined;
    let closedBy: 'browser' | 'versionchange' | 'verifyStoreExists' | 'unknown' = 'unknown';

    const attachHandlers = (db: IDBDatabase) => {
        // It seems like Safari sometimes likes to just close the connection.
        // It's supposed to fire this event when that happens. Let's hope it does!
        // eslint-disable-next-line no-param-reassign
        db.onclose = () => {
            logInfo('IDB connection closed by browser', {dbName, storeName});
            closedBy = 'browser';
            dbp = undefined;
        };

        // When another tab triggers a DB version upgrade, we must close the connection
        // to unblock the upgrade; otherwise the other tab's open request hangs indefinitely.
        // https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event
        // eslint-disable-next-line no-param-reassign
        db.onversionchange = () => {
            logInfo('IDB connection closing due to versionchange', {dbName, storeName});
            closedBy = 'versionchange';
            db.close();
            dbp = undefined;
        };
    };

    const getDB = () => {
        if (dbp) return dbp;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        dbp = IDB.promisifyRequest(request);

        dbp.then(
            attachHandlers,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            () => {},
        );
        return dbp;
    };

    // Ensures the store exists in the DB. If missing, bumps the version to trigger
    // onupgradeneeded, recreates the store, and returns a promise to the new DB.
    const verifyStoreExists = (db: IDBDatabase) => {
        if (db.objectStoreNames.contains(storeName)) {
            return db;
        }

        logInfo(`Store ${storeName} does not exist in database ${dbName}.`);
        const nextVersion = db.version + 1;
        closedBy = 'verifyStoreExists';
        db.close();

        const request = indexedDB.open(dbName, nextVersion);
        request.onupgradeneeded = () => {
            const updatedDatabase = request.result;
            if (updatedDatabase.objectStoreNames.contains(storeName)) {
                return;
            }

            logInfo(`Creating store ${storeName} in database ${dbName}.`);
            updatedDatabase.createObjectStore(storeName);
        };

        dbp = IDB.promisifyRequest(request);
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        dbp.then(attachHandlers, () => {});
        return dbp;
    };

    function executeTransaction<T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>): Promise<T> {
        return getDB()
            .then(verifyStoreExists)
            .then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
    }

    return (txMode, callback) =>
        executeTransaction(txMode, callback).catch((error) => {
            if (error instanceof DOMException && error.name === 'InvalidStateError') {
                logAlert('IDB InvalidStateError, retrying with fresh connection', {
                    dbName,
                    storeName,
                    txMode,
                    closedBy,
                    errorMessage: error.message,
                });
                dbp = undefined;
                closedBy = 'unknown';
                // Retry only once — this call is not wrapped, so if it also fails the error propagates normally.
                return executeTransaction(txMode, callback);
            }
            throw error;
        });
}

export default createStore;
