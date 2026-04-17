/**
 * Shared SQL query constants used by both native and web SQLite providers.
 *
 * These strings are consumed by react-native-nitro-sqlite on iOS/Android and
 * by @sqlite.org/sqlite-wasm on web so they must be plain SQL with `?` or
 * named-parameter placeholders.
 */

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const CREATE_TABLE = 'CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY, valueJSON JSON NOT NULL) WITHOUT ROWID;';
const PRAGMA_CACHE_SIZE = 'PRAGMA CACHE_SIZE=-20000;';
const PRAGMA_SYNCHRONOUS = 'PRAGMA synchronous=NORMAL;';
const PRAGMA_JOURNAL_MODE = 'PRAGMA journal_mode=WAL;';

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

const GET_ITEM = 'SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;';

/**
 * Builds a SELECT ... WHERE record_key IN (...) query for a given number of keys.
 */
function buildMultiGetQuery(count: number): string {
    const placeholders = new Array(count).fill('?').join(',');
    return `SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
}

const GET_ALL_KEYS = 'SELECT record_key FROM keyvaluepairs;';

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

const SET_ITEM = 'REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);';
const MULTI_SET_ITEM = 'REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);';

// ---------------------------------------------------------------------------
// Merge operations
// ---------------------------------------------------------------------------

/**
 * INSERT-or-PATCH: inserts if the key doesn't exist, otherwise applies
 * JSON_PATCH to merge the new value into the existing one.
 */
const MERGE_ITEM_PATCH = `INSERT INTO keyvaluepairs (record_key, valueJSON)
    VALUES (:key, :value)
    ON CONFLICT DO UPDATE
    SET valueJSON = JSON_PATCH(valueJSON, :value);
`;

/**
 * Replaces a specific JSON path inside an existing value.
 * Used to apply FastMergeReplaceNullPatch entries after the JSON_PATCH merge.
 * 
 * NOTE: The JSON() wrapper around the replacement value is required here. Unlike JSON_PATCH (which
 * parses both arguments as JSON internally), JSON_REPLACE treats a plain TEXT binding as a quoted
 * JSON string. Without JSON(), objects would be stored as string values (e.g. "{...}") instead of
 * actual JSON objects, corrupting the stored data.
 */
const MERGE_ITEM_REPLACE = `UPDATE keyvaluepairs
    SET valueJSON = JSON_REPLACE(valueJSON, ?, JSON(?))
    WHERE record_key = ?;
`;

// ---------------------------------------------------------------------------
// Delete operations
// ---------------------------------------------------------------------------

const REMOVE_ITEM = 'DELETE FROM keyvaluepairs WHERE record_key = ?;';

/**
 * Builds a DELETE ... WHERE record_key IN (...) query for a given number of keys.
 */
function buildRemoveItemsQuery(count: number): string {
    const placeholders = new Array(count).fill('?').join(',');
    return `DELETE FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
}

const CLEAR = 'DELETE FROM keyvaluepairs;';

// ---------------------------------------------------------------------------
// Size / diagnostics
// ---------------------------------------------------------------------------

const PRAGMA_PAGE_SIZE = 'PRAGMA page_size;';
const PRAGMA_PAGE_COUNT = 'PRAGMA page_count;';

export {
    CREATE_TABLE,
    PRAGMA_CACHE_SIZE,
    PRAGMA_SYNCHRONOUS,
    PRAGMA_JOURNAL_MODE,
    GET_ITEM,
    buildMultiGetQuery,
    GET_ALL_KEYS,
    SET_ITEM,
    MULTI_SET_ITEM,
    MERGE_ITEM_PATCH,
    MERGE_ITEM_REPLACE,
    REMOVE_ITEM,
    buildRemoveItemsQuery,
    CLEAR,
    PRAGMA_PAGE_SIZE,
    PRAGMA_PAGE_COUNT,
};
