/**
 * Web storage platform selection.
 *
 * Uses the SQLiteProvider (backed by @sqlite.org/sqlite-wasm with opfs-sahpool)
 * as the primary provider, with a runtime fallback to IDBKeyValProvider if OPFS
 * is not supported by the browser.
 */
import SQLiteWebProvider from '../providers/SQLiteProvider';
import IDBKeyValProvider from '../providers/IDBKeyValProvider';
import type StorageProvider from '../providers/types';

/**
 * Check if OPFS (via FileSystemSyncAccessHandle) is available.
 * opfs-sahpool requires this API, which is available in Workers on modern browsers.
 */
function isOPFSSupported(): boolean {
    try {
        // FileSystemSyncAccessHandle is the key API that opfs-sahpool needs.
        // It's available in Worker contexts on Chrome 102+, Firefox 111+, Safari 15.2+.
        // We use a string-based check to avoid TypeScript errors since the type
        // isn't in the standard lib definitions.
        return 'FileSystemSyncAccessHandle' in globalThis;
    } catch {
        return false;
    }
}

/**
 * Check if Workers are supported (required for SQLite WASM with opfs-sahpool).
 */
function isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
}

let WebStorage: StorageProvider<unknown>;

if (isWorkerSupported() && isOPFSSupported()) {
    WebStorage = SQLiteWebProvider;
} else {
    WebStorage = IDBKeyValProvider;
}

export default WebStorage;
