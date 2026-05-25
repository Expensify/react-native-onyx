/**
 * Web storage platform selection.
 *
 * Uses the WorkerStorageProvider to run all persistence off the main thread.
 * Detects OPFS support to choose the best backend:
 * - OPFS + Worker available: SQLite via @sqlite.org/sqlite-wasm with opfs-sahpool VFS
 * - No OPFS: IDBKeyValProvider fallback (still runs in a worker)
 */
import createWorkerStorageProvider from '../WorkerStorageProvider';

/**
 * Check if Web Workers are supported in the current environment.
 */
function isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
}

/**
 * Check if the Origin Private File System (OPFS) is available.
 * OPFS is required for SQLite persistence via the opfs-sahpool VFS.
 * This is a synchronous heuristic -- actual OPFS availability is confirmed
 * by the SQLite WASM library at init time.
 */
function isOPFSSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined' && typeof navigator.storage.getDirectory === 'function';
}

/**
 * Select the best backend based on browser capabilities.
 * Falls back to IDB if OPFS is not available.
 */
function selectBackend(): 'sqlite' | 'idb' {
    if (isWorkerSupported() && isOPFSSupported()) {
        return 'sqlite';
    }
    return 'idb';
}

const backend = selectBackend();
const WebStorage = createWorkerStorageProvider(backend);

export default WebStorage;
