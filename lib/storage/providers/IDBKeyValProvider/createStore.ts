import {promisifyRequest} from 'idb-keyval';
import type {UseStore} from 'idb-keyval';
import {logInfo} from '../../../Logger';

// This is a copy of the createStore function from idb-keyval, but we need to use it to create the store manually.
// We do this because we need to create the database manually in order to ensure that the store exists before we use it.
// If the store does not exist, idb-keyval will throw an error
// source: https://github.com/jakearchibald/idb-keyval/blob/9d19315b4a83897df1e0193dccdc29f78466a0f3/src/index.ts#L12
function createStore(dbName: string, storeName: string): UseStore {
    let database: Promise<IDBDatabase> | undefined;
    const getDB = () => {
        if (database) return database;
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        database = promisifyRequest(request);
        database.then(
            (db) => {
                // It seems like Safari sometimes likes to just close the connection.
                // It's supposed to fire this event when that happens. Let's hope it does!
                // eslint-disable-next-line no-param-reassign
                db.onclose = () => (database = undefined);
            },
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            () => {},
        );

        return database;
    };

    const fixStore = (db: IDBDatabase) => {
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

        database = promisifyRequest(request);
        return database;
    };

    return (txMode, callback) =>
        getDB()
            .then(fixStore)
            .then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

export default createStore;
