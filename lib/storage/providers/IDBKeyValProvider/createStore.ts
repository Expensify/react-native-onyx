import * as IDB from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import * as Logger from '../../../Logger';

const HEAL_ATTEMPTS_MAX = 3;

/**
 * Detects the Chromium-specific IDB backing store corruption error.
 * Fires when LevelDB files backing IndexedDB are corrupted and Chrome's
 * internal recovery (RepairDB -> delete -> recreate) also fails.
 */
function isBackingStoreError(error: unknown): boolean {
    return (error instanceof Error || error instanceof DOMException) && (error as Error).message.includes('Internal error opening backing store');
}

/**
 * Detects Safari/WebKit IDB connection termination errors.
 * Fires when Safari kills the IDB server process for backgrounded tabs.
 * WebKit bugs: https://bugs.webkit.org/show_bug.cgi?id=197050, https://bugs.webkit.org/show_bug.cgi?id=201483
 */
function isConnectionLostError(error: unknown): boolean {
    if (!(error instanceof Error || error instanceof DOMException)) return false;
    const msg = (error as Error).message.toLowerCase();
    return msg.includes('connection to indexed database server lost') || msg.includes('connection is closing');
}

function isInvalidStateError(error: unknown): boolean {
    return (error instanceof Error || error instanceof DOMException) && (error as Error).name === 'InvalidStateError';
}

/** Errors that trigger a budgeted heal-and-retry in store(). */
function isBudgetedHealError(error: unknown): boolean {
    return isBackingStoreError(error) || isConnectionLostError(error);
}

function getBudgetedHealErrorLabel(error: unknown): string {
    if (isBackingStoreError(error)) return 'backing store';
    if (isConnectionLostError(error)) return 'connection lost';
    return 'unknown';
}

/** Union of all error types indicating a stale/dead IDB connection. Used by the visibilitychange probe. */
function isStaleConnectionError(error: unknown): boolean {
    return isInvalidStateError(error) || isBackingStoreError(error) || isConnectionLostError(error);
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

    // Cache the open promise and attach handlers + rejection cleanup.
    // On rejection, clears dbp so the next operation retries with a fresh indexedDB.open()
    // instead of returning the same rejected promise.
    // Guard: only clear if dbp hasn't been replaced by a concurrent heal/retry.
    function cacheOpenPromise(openPromise: Promise<IDBDatabase>) {
        dbp = openPromise;
        const currentPromise = openPromise;
        openPromise.then(attachHandlers, () => {
            if (dbp !== currentPromise) {
                return;
            }
            dbp = undefined;
        });
        return openPromise;
    }

    const getDB = () => {
        if (dbp) return dbp;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        return cacheOpenPromise(IDB.promisifyRequest(request));
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

        return cacheOpenPromise(IDB.promisifyRequest(request));
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

    // Proactive IDB health check when tab returns to foreground.
    // Safari kills IDB connections for backgrounded tabs. By probing as soon as
    // the tab becomes visible, we drop the stale dbp early so the first real
    // operation opens a fresh connection instead of failing.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !dbp) {
            return;
        }

        Logger.logInfo('IDB visibilitychange probe: tab became visible, checking connection health', {dbName, storeName});

        const probePromise = dbp;

        const dropCacheIfStale = (error: unknown) => {
            if (dbp !== probePromise || !isStaleConnectionError(error)) {
                return;
            }
            Logger.logAlert('IDB visibilitychange probe: stale connection detected, dropping cached connection', {
                dbName,
                storeName,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
            dbp = undefined;
        };

        probePromise.then((db) => {
            if (dbp !== probePromise) {
                return;
            }
            try {
                const tx = db.transaction(storeName, 'readonly');
                const probeStore = tx.objectStore(storeName);
                const req = probeStore.count();
                req.onsuccess = () => {
                    Logger.logInfo('IDB visibilitychange probe: connection is healthy', {dbName, storeName});
                };
                req.onerror = () => {
                    dropCacheIfStale(req.error);
                };
            } catch (error) {
                dropCacheIfStale(error);
            }
        });
    });

    // Handles three recoverable error classes:
    // 1. InvalidStateError — connection closed between getDB() resolving and db.transaction().
    //    Retry once with a fresh connection. No budget limit (transient, always worth one reopen).
    // 2. Backing store corruption (Chromium UnknownError) — drop cached connection and reopen.
    // 3. Connection lost (Safari UnknownError) — IDB server terminated for backgrounded tabs.
    //    Both 2 and 3 share a heal budget (3 attempts, reset on success).
    //    Mirrors Dexie's PR1398_maxLoop pattern: https://github.com/dexie/Dexie.js/blob/master/src/functions/temp-transaction.ts
    // Note: concurrent store() calls share the budget. Under overlapping failures each caller
    // decrements independently, so the budget may drain faster than one-per-incident. This is
    // acceptable — same as Dexie's approach — and the budget resets on any success.
    return (txMode, callback) =>
        executeTransaction(txMode, callback)
            .then(resetHealBudget)
            .catch((error) => {
                if (isInvalidStateError(error)) {
                    Logger.logInfo('IDB InvalidStateError — dropping cached connection and retrying', {
                        dbName,
                        storeName,
                        txMode,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                    dbp = undefined;
                    return executeTransaction(txMode, callback).then(resetHealBudget);
                }

                if (isBudgetedHealError(error) && healAttemptsRemaining > 0) {
                    healAttemptsRemaining--;
                    const label = getBudgetedHealErrorLabel(error);
                    Logger.logInfo(`IDB heal: ${label} error detected — dropping cached connection and reopening (${healAttemptsRemaining} attempts left)`, {
                        dbName,
                        storeName,
                    });
                    dbp = undefined;
                    return executeTransaction(txMode, callback).then((result) => {
                        Logger.logInfo(`IDB heal: successfully recovered after ${label} error`, {dbName, storeName});
                        return resetHealBudget(result);
                    });
                }

                if (isBudgetedHealError(error)) {
                    Logger.logAlert(`IDB heal: ${getBudgetedHealErrorLabel(error)} error — heal budget exhausted, giving up`, {
                        dbName,
                        storeName,
                    });
                } else {
                    Logger.logAlert('IDB error is not recoverable, giving up', {
                        dbName,
                        storeName,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                }
                throw error;
            });
}

export default createStore;
