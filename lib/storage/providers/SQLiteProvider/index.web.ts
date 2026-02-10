/**
 * Web SQLite Storage Provider
 *
 * Implements the StorageProvider interface using @sqlite.org/sqlite-wasm with
 * the opfs-sahpool VFS for OPFS-backed persistence. This module is imported
 * by the unified storage worker (lib/storage/worker.ts), NOT by the main thread.
 *
 * All methods are synchronous (SQLite WASM operations are sync), but conform
 * to the StorageProvider interface which returns Promises.
 */

import utils from '../../../utils';
import type StorageProvider from '../types';
import type {StorageKeyList, StorageKeyValuePair} from '../types';

// Type declarations for the SQLite WASM API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteDB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteStmt = any;

// ---------------------------------------------------------------------------
// SQLite WASM and database state
// ---------------------------------------------------------------------------

let db: SQLiteDB | null = null;

// Prepared statements (initialized once, reused for all operations)
let stmtGetItem: SQLiteStmt | null = null;
let stmtSetItem: SQLiteStmt | null = null;
let stmtSetItemJson: SQLiteStmt | null = null;
let stmtMergePatch: SQLiteStmt | null = null;
let stmtMergeReplace: SQLiteStmt | null = null;
let stmtRemoveItem: SQLiteStmt | null = null;
let stmtGetAllKeys: SQLiteStmt | null = null;
let stmtClear: SQLiteStmt | null = null;

/**
 * Marker key used by fastMerge to flag object replacements.
 * Duplicated here from utils to avoid importing the full utils module into the worker.
 */
const ONYX_INTERNALS__REPLACE_OBJECT_MARK = 'ONYX_INTERNALS__REPLACE_OBJECT_MARK';

/**
 * JSON.stringify replacer that strips internal object-replacement markers
 * before persisting merge patches.
 */
function objectMarkRemover(key: string, value: unknown) {
    if (key === ONYX_INTERNALS__REPLACE_OBJECT_MARK) return undefined;
    return value;
}

/**
 * Transforms replaceNullPatches into [jsonPath, valueJSON, key] tuples for
 * the JSON_REPLACE prepared statement.
 */
function generateJSONReplaceSQLQueries(key: string, patches: [string[], unknown][]): string[][] {
    return patches.map(([pathArray, value]) => {
        const jsonPath = `$.${pathArray.join('.')}`;
        return [jsonPath, JSON.stringify(value), key];
    });
}

const provider: StorageProvider<SQLiteDB | null> = {
    store: null,

    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'SQLiteProvider (Web)',

    /**
     * Initialize the SQLite WASM database with opfs-sahpool VFS.
     */
    init() {
        // Actual async initialization happens via initAsync() below.
        // The worker calls initAsync() and awaits it.
    },

    getItem(key) {
        stmtGetItem.bind([key]);
        if (stmtGetItem.step()) {
            const valueJSON = stmtGetItem.getString(1) as string;
            stmtGetItem.reset();
            return Promise.resolve(JSON.parse(valueJSON));
        }
        stmtGetItem.reset();
        return Promise.resolve(null);
    },

    multiGet(keys) {
        const results: StorageKeyValuePair[] = [];
        for (const key of keys) {
            stmtGetItem.bind([key]);
            if (stmtGetItem.step()) {
                results.push([stmtGetItem.getString(0) as string, JSON.parse(stmtGetItem.getString(1) as string)]);
            }
            stmtGetItem.reset();
        }
        return Promise.resolve(results);
    },

    setItem(key, value) {
        const valueJSON = JSON.stringify(value);
        stmtSetItem.bind([key, valueJSON]);
        stmtSetItem.stepReset();
        return Promise.resolve();
    },

    multiSet(pairs) {
        if (utils.isEmptyObject(pairs)) {
            return Promise.resolve();
        }
        db.exec('BEGIN;');
        try {
            for (const [key, value] of pairs) {
                const valueJSON = JSON.stringify(value === undefined ? null : value);
                stmtSetItemJson.bind([key, valueJSON]);
                stmtSetItemJson.stepReset();
            }
            db.exec('COMMIT;');
        } catch (e) {
            db.exec('ROLLBACK;');
            throw e;
        }
        return Promise.resolve();
    },

    multiMerge(pairs) {
        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);
        db.exec('BEGIN;');
        try {
            for (const [key, change, replaceNullPatches] of nonNullishPairs) {
                // Stringify the change, stripping internal object-replacement markers
                const changeJSON = JSON.stringify(change, objectMarkRemover);

                // Apply JSON_PATCH merge
                stmtMergePatch.bind([key, changeJSON, changeJSON]);
                stmtMergePatch.stepReset();

                // Generate and apply JSON_REPLACE patches if any
                const patches = (replaceNullPatches ?? []) as [string[], unknown][];
                if (patches.length > 0) {
                    const replaceQueries = generateJSONReplaceSQLQueries(key, patches);
                    for (const [jsonPath, patchValue, replaceKey] of replaceQueries) {
                        stmtMergeReplace.bind([jsonPath, patchValue, replaceKey]);
                        stmtMergeReplace.stepReset();
                    }
                }
            }
            db.exec('COMMIT;');
        } catch (e) {
            db.exec('ROLLBACK;');
            throw e;
        }
        return Promise.resolve();
    },

    mergeItem(key, change, replaceNullPatches) {
        return provider.multiMerge([[key, change, replaceNullPatches]]);
    },

    getAllKeys() {
        const keys: StorageKeyList = [];
        while (stmtGetAllKeys.step()) {
            keys.push(stmtGetAllKeys.getString(0) as string);
        }
        stmtGetAllKeys.reset();
        return Promise.resolve(keys);
    },

    removeItem(key) {
        stmtRemoveItem.bind([key]);
        stmtRemoveItem.stepReset();
        return Promise.resolve();
    },

    removeItems(keys) {
        db.exec('BEGIN;');
        try {
            for (const key of keys) {
                stmtRemoveItem.bind([key]);
                stmtRemoveItem.stepReset();
            }
            db.exec('COMMIT;');
        } catch (e) {
            db.exec('ROLLBACK;');
            throw e;
        }
        return Promise.resolve();
    },

    clear() {
        stmtClear.stepReset();
        return Promise.resolve();
    },

    getDatabaseSize() {
        const pageSizeRow = db.exec('PRAGMA page_size;', {returnValue: 'resultRows'});
        const pageCountRow = db.exec('PRAGMA page_count;', {returnValue: 'resultRows'});

        const pageSize = pageSizeRow?.[0]?.[0] ?? 0;
        const pageCount = pageCountRow?.[0]?.[0] ?? 0;

        return Promise.resolve({
            bytesUsed: (pageSize as number) * (pageCount as number),
            bytesRemaining: Number.POSITIVE_INFINITY,
        });
    },
};

/**
 * Async initialization for the SQLite WASM database.
 * Must be called (and awaited) before using any other provider methods.
 */
async function initAsync(): Promise<void> {
    // Dynamic import of the SQLite WASM module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
    const sqlite3 = await sqlite3InitModule();

    // Try to install opfs-sahpool VFS
    try {
        const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
            name: 'opfs-sahpool',
            directory: '/onyx-opfs',
            initialCapacity: 6,
        });

        // Open the database using the opfs-sahpool VFS
        db = new poolUtil.OpfsSAHPoolDb('/OnyxDB');
    } catch (opfsError) {
        // If opfs-sahpool is not available, fall back to in-memory
        // (the main thread will handle the full IDB fallback)
        console.warn('opfs-sahpool VFS not available, using in-memory SQLite:', opfsError);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        db = new sqlite3.oo1.DB(':memory:');
    }

    // Initialize the schema and pragmas
    db.exec('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY, valueJSON JSON NOT NULL) WITHOUT ROWID;');
    db.exec('PRAGMA CACHE_SIZE=-20000;');
    db.exec('PRAGMA synchronous=NORMAL;');
    db.exec('PRAGMA journal_mode=WAL;');

    // Prepare reusable statements
    stmtGetItem = db.prepare('SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;');
    stmtSetItem = db.prepare('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);');
    stmtSetItemJson = db.prepare('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, json(?));');
    stmtMergePatch = db.prepare(
        `INSERT INTO keyvaluepairs (record_key, valueJSON)
         VALUES (?, JSON(?))
         ON CONFLICT DO UPDATE
         SET valueJSON = JSON_PATCH(valueJSON, JSON(?));`,
    );
    stmtMergeReplace = db.prepare(
        `UPDATE keyvaluepairs
         SET valueJSON = JSON_REPLACE(valueJSON, ?, JSON(?))
         WHERE record_key = ?;`,
    );
    stmtRemoveItem = db.prepare('DELETE FROM keyvaluepairs WHERE record_key = ?;');
    stmtGetAllKeys = db.prepare('SELECT record_key FROM keyvaluepairs;');
    stmtClear = db.prepare('DELETE FROM keyvaluepairs;');

    provider.store = db;
}

export default provider;
export {initAsync};
