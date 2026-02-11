/**
 * Worker Storage Provider
 *
 * Main-thread proxy that communicates with the storage Web Worker
 * (lib/storage/worker.ts). Implements the StorageProvider interface
 * so it can be used as a drop-in replacement for any storage backend on web.
 *
 * The caller chooses the backend at creation time:
 * - 'sqlite': @sqlite.org/sqlite-wasm with opfs-sahpool VFS
 * - 'idb': IDBKeyValProvider fallback for browsers without OPFS
 *
 * All database operations are offloaded to the worker. This provider only
 * manages the postMessage protocol and Promise resolution. Values pass
 * through structured clone (native JS objects), so no JSON.parse is needed
 * on the main thread.
 */

import utils from '../utils';
import type StorageProvider from './providers/types';
import type {StorageKeyList, StorageKeyValuePair} from './providers/types';

// Message counter for matching responses to requests
let nextMessageId = 0;

// Promise registry keyed by message ID
const pendingRequests = new Map<string, {resolve: (value: unknown) => void; reject: (reason: unknown) => void}>();

/**
 * Generate a unique message ID for request-response matching.
 */
function generateId(): string {
    nextMessageId += 1;
    return `msg_${nextMessageId}_${Date.now()}`;
}

/**
 * The worker instance (created during init).
 */
let worker: Worker | null = null;

/**
 * Send a message to the worker and return a Promise that resolves with the result.
 */
function postToWorker<T>(message: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (!worker) {
            reject(new Error('Storage worker not initialized'));
            return;
        }

        const id = generateId();
        pendingRequests.set(id, {
            resolve: resolve as (value: unknown) => void,
            reject,
        });

        worker.postMessage({...message, id});
    });
}

/**
 * Handle messages from the worker. Matches response to pending request by ID.
 */
function handleWorkerMessage(event: MessageEvent): void {
    const {type, id, data, error} = event.data;
    if (type !== 'result') return;

    const pending = pendingRequests.get(id);
    if (!pending) return;
    pendingRequests.delete(id);

    if (error) {
        pending.reject(new Error(error));
    } else {
        pending.resolve(data);
    }
}

/**
 * Create a WorkerStorageProvider that delegates all operations to the
 * storage web worker. The caller specifies the backend to use:
 * - 'sqlite': @sqlite.org/sqlite-wasm with opfs-sahpool VFS (preferred)
 * - 'idb': IDBKeyValProvider fallback
 *
 * @param backend - The storage backend for the worker to use
 */
function createWorkerStorageProvider(backend: 'sqlite' | 'idb'): StorageProvider<Worker | null> {
    const provider: StorageProvider<Worker | null> = {
        store: null,

        /**
         * The name of the provider that can be printed to the logs
         */
        name: `WorkerStorageProvider (${backend})`,

        /**
         * Initializes the storage provider by spawning the web worker.
         * The worker is told which backend to use via the init message.
         *
         * Returns a Promise that resolves once the worker has finished
         * initializing its storage backend (SQLite or IDB). This ensures
         * that callers waiting on Storage.init() don't proceed until the
         * worker is actually ready to accept data operations.
         */
        init() {
            // Create the worker. The bundler (webpack/vite) will handle the URL resolution.
            worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
            worker.onmessage = handleWorkerMessage;
            worker.onerror = (error) => {
                console.error('Storage worker error:', error);
            };

            provider.store = worker;

            // Send init message with the chosen backend and return the Promise
            // so that Storage.init() can await worker readiness.
            return postToWorker<void>({type: 'init', backend}).catch((error) => {
                console.error('Failed to initialize storage worker:', error);
            });
        },

        getItem(key) {
            return postToWorker<unknown>({type: 'getItem', key}).then((result) => {
                if (result === null || result === undefined) {
                    return null;
                }
                return result;
            });
        },

        multiGet(keys) {
            return postToWorker<StorageKeyValuePair[]>({type: 'multiGet', keys}).then((results) => {
                return results ?? [];
            });
        },

        setItem(key, value) {
            return postToWorker<void>({type: 'setItem', key, value});
        },

        multiSet(pairs) {
            if (utils.isEmptyObject(pairs)) {
                return Promise.resolve();
            }
            const normalized = pairs.map(([key, value]) => [key, value === undefined ? null : value]);
            return postToWorker<void>({type: 'multiSet', pairs: normalized});
        },

        multiMerge(pairs) {
            const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);
            const prepared = nonNullishPairs.map(([key, value, replaceNullPatches]) => {
                return [key, value, replaceNullPatches] as [string, unknown, unknown[] | undefined];
            });
            return postToWorker<void>({type: 'multiMerge', pairs: prepared});
        },

        mergeItem(key, change, replaceNullPatches) {
            return provider.multiMerge([[key, change, replaceNullPatches]]);
        },

        getAllKeys() {
            return postToWorker<string[]>({type: 'getAllKeys'}).then((keys) => (keys ?? []) as StorageKeyList);
        },

        removeItem(key) {
            return postToWorker<void>({type: 'removeItem', key});
        },

        removeItems(keys) {
            return postToWorker<void>({type: 'removeItems', keys});
        },

        clear() {
            return postToWorker<void>({type: 'clear'});
        },

        getDatabaseSize() {
            return postToWorker<{bytesUsed: number; bytesRemaining: number}>({type: 'getDatabaseSize'}).then((size) => {
                // Supplement with StorageManager if available for more accurate remaining space
                if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
                    return navigator.storage.estimate().then((estimate) => ({
                        bytesUsed: size.bytesUsed,
                        bytesRemaining: (estimate.quota ?? 0) - (estimate.usage ?? 0),
                    }));
                }
                return size;
            });
        },
    };

    return provider;
}

export default createWorkerStorageProvider;
