/**
 * Web storage platform selection.
 *
 * Uses the WorkerStorageProvider to run all persistence off the main thread.
 * If OPFS is available, the worker uses the SQLite WASM backend (opfs-sahpool).
 * Otherwise, it falls back to the IndexedDB backend (idb-keyval).
 *
 * Both backends run inside the same unified worker (lib/storage/worker.ts).
 */
import createWorkerStorageProvider from '../WorkerStorageProvider';

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
 * Check if Workers are supported (required for both backends).
 */
function isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
}

const backend = isWorkerSupported() && isOPFSSupported() ? 'sqlite' : 'idb';
const WebStorage = createWorkerStorageProvider(backend);

export default WebStorage;
