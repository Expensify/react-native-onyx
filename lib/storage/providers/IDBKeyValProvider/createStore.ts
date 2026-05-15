import * as IDB from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import * as Logger from '../../../Logger';

const HEAL_ATTEMPTS_MAX = 3;

/**
 * Detects the Chromium-specific IDB backing store corruption error.
 * Fires when LevelDB files backing IndexedDB are corrupted and Chrome's
 * internal recovery (RepairDB -> delete -> recreate) also fails.
 * https://github.com/Expensify/App/issues/87862
 */
function isBackingStoreError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'UnknownError' && error.message.includes('Internal error opening backing store');
}

// This is a copy of the createStore function from idb-keyval, we need a custom implementation
// because we need to create the database manually in order to ensure that the store exists before we use it.
// If the store does not exist, idb-keyval will throw an error
// source: https://github.com/jakearchibald/idb-keyval/blob/9d19315b4a83897df1e0193dccdc29f78466a0f3/src/index.ts#L12
function createStore(dbName: string, storeName: string): UseStore {
    let dbp: Promise<IDBDatabase> | undefined;
    let healAttemptsRemaining = HEAL_ATTEMPTS_MAX;

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

    function resetHealBudget<T>(result: T): T {
        healAttemptsRemaining = HEAL_ATTEMPTS_MAX;
        return result;
    }

    // Handles two recoverable error classes:
    // 1. InvalidStateError — connection closed between getDB() resolving and db.transaction().
    //    Retry once with a fresh connection.
    // 2. Backing store corruption (Chromium UnknownError) — close + reopen the IDB connection.
    //    Bounded by a shared heal budget (3 attempts, reset on success).
    //    Mirrors Dexie's PR1398_maxLoop pattern: https://github.com/dexie/Dexie.js/blob/master/src/functions/temp-transaction.ts
    return (txMode, callback) =>
        executeTransaction(txMode, callback)
            .then(resetHealBudget)
            .catch((error) => {
                if (error instanceof DOMException && error.name === 'InvalidStateError') {
                    Logger.logAlert('IDB InvalidStateError, retrying with fresh connection', {
                        dbName,
                        storeName,
                        txMode,
                        errorMessage: error.message,
                    });
                    dbp = undefined;
                    return executeTransaction(txMode, callback).then(resetHealBudget);
                }

                if (isBackingStoreError(error) && healAttemptsRemaining > 0) {
                    healAttemptsRemaining--;
                    Logger.logInfo('IDB heal: backing store error, attempting close + reopen', {
                        dbName,
                        storeName,
                        healAttemptsRemaining,
                    });
                    dbp = undefined;
                    return executeTransaction(txMode, callback).then(resetHealBudget);
                }

                throw error;
            });
}

export default createStore;
