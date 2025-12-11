import * as IDB from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import {logInfo} from '../../../Logger';

// This is a copy of the createStore function from idb-keyval, we need a custom implementation
// because we need to create the database manually in order to ensure that the store exists before we use it.
// If the store does not exist, idb-keyval will throw an error
// source: https://github.com/jakearchibald/idb-keyval/blob/9d19315b4a83897df1e0193dccdc29f78466a0f3/src/index.ts#L12
function createStore(dbName: string, storeName: string): UseStore {
    let dbp: Promise<IDBDatabase> | undefined;
    const getDB = () => {
        if (dbp) return dbp;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        dbp = IDB.promisifyRequest(request);

        dbp.then(
            (db) => {
                // It seems like Safari sometimes likes to just close the connection.
                // It's supposed to fire this event when that happens. Let's hope it does!
                // eslint-disable-next-line no-param-reassign
                db.onclose = () => (dbp = undefined);
            },
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
        return dbp;
    };

    return (txMode, callback) =>
        getDB()
            .then(verifyStoreExists)
            .then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

export default createStore;
