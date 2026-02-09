/**
 * SQLite WASM Web Worker
 *
 * This worker runs the official @sqlite.org/sqlite-wasm build with the
 * opfs-sahpool VFS for OPFS-backed persistence. It handles all database
 * operations off the main thread and communicates via postMessage.
 *
 * After each write operation, changed keys are broadcast to other tabs via
 * BroadcastChannel so they can update their caches.
 */

// Type declarations for the SQLite WASM API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteDB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteStmt = any;

// ---------------------------------------------------------------------------
// Message types for main-thread <-> worker communication
// ---------------------------------------------------------------------------

type InitMessage = {type: 'init'; id: string};
type GetItemMessage = {type: 'getItem'; id: string; key: string};
type MultiGetMessage = {type: 'multiGet'; id: string; keys: string[]};
type SetItemMessage = {type: 'setItem'; id: string; key: string; value: string};
type MultiSetMessage = {type: 'multiSet'; id: string; pairs: [string, string][]};
type MultiMergeMessage = {type: 'multiMerge'; id: string; pairs: [string, string, string[][] | undefined][]};
type GetAllKeysMessage = {type: 'getAllKeys'; id: string};
type RemoveItemMessage = {type: 'removeItem'; id: string; key: string};
type RemoveItemsMessage = {type: 'removeItems'; id: string; keys: string[]};
type ClearMessage = {type: 'clear'; id: string};
type GetDatabaseSizeMessage = {type: 'getDatabaseSize'; id: string};
type GetAllPairsMessage = {type: 'getAllPairs'; id: string};

type WorkerMessage =
    | InitMessage
    | GetItemMessage
    | MultiGetMessage
    | SetItemMessage
    | MultiSetMessage
    | MultiMergeMessage
    | GetAllKeysMessage
    | RemoveItemMessage
    | RemoveItemsMessage
    | ClearMessage
    | GetDatabaseSizeMessage
    | GetAllPairsMessage;

type ResultMessage = {type: 'result'; id: string; data?: unknown; error?: string};

// ---------------------------------------------------------------------------
// SQLite WASM and database state
// ---------------------------------------------------------------------------

let db: SQLiteDB | null = null;
let broadcastChannel: BroadcastChannel | null = null;

// Prepared statements (initialized once, reused for all operations)
let stmtGetItem: SQLiteStmt | null = null;
let stmtSetItem: SQLiteStmt | null = null;
let stmtSetItemJson: SQLiteStmt | null = null;
let stmtMergePatch: SQLiteStmt | null = null;
let stmtMergeReplace: SQLiteStmt | null = null;
let stmtRemoveItem: SQLiteStmt | null = null;
let stmtGetAllKeys: SQLiteStmt | null = null;
let stmtClear: SQLiteStmt | null = null;

const BROADCAST_CHANNEL_NAME = 'onyx-sync';

/**
 * Broadcast changed keys to other tabs after persistence.
 */
function broadcastChangedKeys(keys: string[]): void {
    if (broadcastChannel && keys.length > 0) {
        broadcastChannel.postMessage({type: 'keysChanged', keys});
    }
}

/**
 * Initialize the SQLite WASM database with opfs-sahpool VFS.
 */
async function initDatabase(): Promise<void> {
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

    // Initialize BroadcastChannel for cross-tab sync
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
}

/**
 * Handle getItem: returns {key, value} or null
 */
function handleGetItem(key: string): {key: string; value: string} | null {
    stmtGetItem.bind([key]);
    if (stmtGetItem.step()) {
        const result = {
            key: stmtGetItem.getString(0) as string,
            value: stmtGetItem.getString(1) as string,
        };
        stmtGetItem.reset();
        return result;
    }
    stmtGetItem.reset();
    return null;
}

/**
 * Handle multiGet: returns array of [key, valueJSON] pairs
 */
function handleMultiGet(keys: string[]): [string, string][] {
    const results: [string, string][] = [];
    for (const key of keys) {
        stmtGetItem.bind([key]);
        if (stmtGetItem.step()) {
            results.push([stmtGetItem.getString(0) as string, stmtGetItem.getString(1) as string]);
        }
        stmtGetItem.reset();
    }
    return results;
}

/**
 * Handle setItem
 */
function handleSetItem(key: string, valueJSON: string): void {
    stmtSetItem.bind([key, valueJSON]);
    stmtSetItem.stepReset();
    broadcastChangedKeys([key]);
}

/**
 * Handle multiSet: batch insert/replace within a transaction
 */
function handleMultiSet(pairs: [string, string][]): void {
    db.exec('BEGIN;');
    try {
        const changedKeys: string[] = [];
        for (const [key, valueJSON] of pairs) {
            stmtSetItemJson.bind([key, valueJSON]);
            stmtSetItemJson.stepReset();
            changedKeys.push(key);
        }
        db.exec('COMMIT;');
        broadcastChangedKeys(changedKeys);
    } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
    }
}

/**
 * Handle multiMerge: JSON_PATCH merge + optional JSON_REPLACE within a transaction
 */
function handleMultiMerge(pairs: [string, string, string[][] | undefined][]): void {
    db.exec('BEGIN;');
    try {
        const changedKeys: string[] = [];
        for (const [key, changeJSON, replaceQueries] of pairs) {
            // Apply JSON_PATCH merge
            stmtMergePatch.bind([key, changeJSON, changeJSON]);
            stmtMergePatch.stepReset();
            changedKeys.push(key);

            // Apply JSON_REPLACE patches if any
            if (replaceQueries && replaceQueries.length > 0) {
                for (const [jsonPath, value, replaceKey] of replaceQueries) {
                    stmtMergeReplace.bind([jsonPath, value, replaceKey]);
                    stmtMergeReplace.stepReset();
                }
            }
        }
        db.exec('COMMIT;');
        broadcastChangedKeys(changedKeys);
    } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
    }
}

/**
 * Handle getAllKeys: returns array of key strings
 */
function handleGetAllKeys(): string[] {
    const keys: string[] = [];
    while (stmtGetAllKeys.step()) {
        keys.push(stmtGetAllKeys.getString(0) as string);
    }
    stmtGetAllKeys.reset();
    return keys;
}

/**
 * Handle removeItem
 */
function handleRemoveItem(key: string): void {
    stmtRemoveItem.bind([key]);
    stmtRemoveItem.stepReset();
    broadcastChangedKeys([key]);
}

/**
 * Handle removeItems: batch delete within a transaction
 */
function handleRemoveItems(keys: string[]): void {
    db.exec('BEGIN;');
    try {
        for (const key of keys) {
            stmtRemoveItem.bind([key]);
            stmtRemoveItem.stepReset();
        }
        db.exec('COMMIT;');
        broadcastChangedKeys(keys);
    } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
    }
}

/**
 * Handle clear: delete all rows
 */
function handleClear(): void {
    stmtClear.stepReset();
    broadcastChangedKeys(['__clear__']);
}

/**
 * Handle getDatabaseSize: returns {bytesUsed, bytesRemaining}
 */
function handleGetDatabaseSize(): {bytesUsed: number; bytesRemaining: number} {
    const pageSizeRow = db.exec('PRAGMA page_size;', {returnValue: 'resultRows'});
    const pageCountRow = db.exec('PRAGMA page_count;', {returnValue: 'resultRows'});

    const pageSize = pageSizeRow?.[0]?.[0] ?? 0;
    const pageCount = pageCountRow?.[0]?.[0] ?? 0;

    // Use StorageManager API for remaining space if available
    let bytesRemaining = Number.POSITIVE_INFINITY;
    // Note: StorageManager.estimate() is async, but we handle this at the proxy level

    return {
        bytesUsed: (pageSize as number) * (pageCount as number),
        bytesRemaining,
    };
}

/**
 * Handle getAllPairs: returns all key-value pairs for cold-start hydration
 */
function handleGetAllPairs(): [string, string][] {
    const pairs: [string, string][] = [];
    const stmt = db.prepare('SELECT record_key, valueJSON FROM keyvaluepairs;');
    while (stmt.step()) {
        pairs.push([stmt.getString(0) as string, stmt.getString(1) as string]);
    }
    stmt.finalize();
    return pairs;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function sendResult(id: string, data?: unknown, error?: string): void {
    const msg: ResultMessage = {type: 'result', id};
    if (data !== undefined) {
        msg.data = data;
    }
    if (error !== undefined) {
        msg.error = error;
    }
    self.postMessage(msg);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    try {
        switch (msg.type) {
            case 'init':
                await initDatabase();
                sendResult(msg.id);
                break;

            case 'getItem': {
                const result = handleGetItem(msg.key);
                sendResult(msg.id, result);
                break;
            }

            case 'multiGet': {
                const results = handleMultiGet(msg.keys);
                sendResult(msg.id, results);
                break;
            }

            case 'setItem':
                handleSetItem(msg.key, msg.value);
                sendResult(msg.id);
                break;

            case 'multiSet':
                handleMultiSet(msg.pairs);
                sendResult(msg.id);
                break;

            case 'multiMerge':
                handleMultiMerge(msg.pairs);
                sendResult(msg.id);
                break;

            case 'getAllKeys': {
                const keys = handleGetAllKeys();
                sendResult(msg.id, keys);
                break;
            }

            case 'removeItem':
                handleRemoveItem(msg.key);
                sendResult(msg.id);
                break;

            case 'removeItems':
                handleRemoveItems(msg.keys);
                sendResult(msg.id);
                break;

            case 'clear':
                handleClear();
                sendResult(msg.id);
                break;

            case 'getDatabaseSize': {
                const size = handleGetDatabaseSize();
                sendResult(msg.id, size);
                break;
            }

            case 'getAllPairs': {
                const pairs = handleGetAllPairs();
                sendResult(msg.id, pairs);
                break;
            }

            default:
                sendResult((msg as {id: string}).id, undefined, `Unknown message type: ${(msg as {type: string}).type}`);
        }
    } catch (error) {
        sendResult(msg.id, undefined, error instanceof Error ? error.message : String(error));
    }
};

export type {WorkerMessage, ResultMessage};
