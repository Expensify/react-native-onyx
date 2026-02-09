/**
 * Web SQLite Storage Provider
 *
 * Main-thread proxy that communicates with a Web Worker running SQLite WASM
 * with opfs-sahpool VFS. Implements the StorageProvider interface so it can
 * be used as a drop-in replacement for IDBKeyValProvider on web.
 *
 * All database operations are offloaded to the worker. This provider only
 * manages the message protocol and Promise resolution.
 */

import utils from '../../../utils';
import type {FastMergeReplaceNullPatch} from '../../../utils';
import type StorageProvider from '../types';
import type {OnStorageKeyChanged, StorageKeyList, StorageKeyValuePair} from '../types';

// Message counter for matching responses to requests
let nextMessageId = 0;

// Promise registry keyed by message ID
const pendingRequests = new Map<string, {resolve: (value: unknown) => void; reject: (reason: unknown) => void}>();

// The worker instance
let worker: Worker | null = null;

// BroadcastChannel for receiving cross-tab sync events
let syncChannel: BroadcastChannel | null = null;

const BROADCAST_CHANNEL_NAME = 'onyx-sync';

/**
 * Generate a unique message ID for request-response matching.
 */
function generateId(): string {
    nextMessageId += 1;
    return `msg_${nextMessageId}_${Date.now()}`;
}

/**
 * Send a message to the worker and return a Promise that resolves with the result.
 */
function postToWorker<T>(message: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (!worker) {
            reject(new Error('SQLite worker not initialized'));
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
 * Prevents the stringifying of the object markers.
 */
function objectMarkRemover(key: string, value: unknown) {
    if (key === utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK) return undefined;
    return value;
}

/**
 * Transforms the replace null patches into SQL queries to be passed to JSON_REPLACE.
 */
function generateJSONReplaceSQLQueries(key: string, patches: FastMergeReplaceNullPatch[]): string[][] {
    return patches.map(([pathArray, value]) => {
        const jsonPath = `$.${pathArray.join('.')}`;
        return [jsonPath, JSON.stringify(value), key];
    });
}

const provider: StorageProvider<Worker | null> = {
    store: null,

    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'SQLiteProvider (Web)',

    /**
     * Initializes the storage provider by creating the worker and
     * waiting for the SQLite database to be ready.
     */
    init() {
        // Create the worker. The bundler (webpack/vite) will handle the URL resolution.
        worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
        worker.onmessage = handleWorkerMessage;
        worker.onerror = (error) => {
            console.error('SQLite worker error:', error);
        };

        provider.store = worker;

        // Send init message and wait for it to complete (blocking init)
        // We use a synchronous-looking pattern here because init() is void,
        // but the initPromise in storage/index.ts handles the async wait.
        const initPromise = postToWorker<void>({type: 'init'});

        // We need to make init() synchronous from the caller's perspective,
        // so we throw if the worker fails to initialize. The storage layer
        // wraps this in tryOrDegradePerformance which handles the rejection.
        initPromise.catch((error) => {
            console.error('Failed to initialize SQLite worker:', error);
        });
    },

    getItem(key) {
        return postToWorker<{key: string; value: string} | null>({type: 'getItem', key}).then((result) => {
            if (result === null || result === undefined) {
                return null;
            }
            return JSON.parse(result.value);
        });
    },

    multiGet(keys) {
        return postToWorker<[string, string][]>({type: 'multiGet', keys}).then((results) => {
            return (results ?? []).map(([key, valueJSON]) => [key, JSON.parse(valueJSON)]) as StorageKeyValuePair[];
        });
    },

    setItem(key, value) {
        const valueJSON = JSON.stringify(value);
        return postToWorker<void>({type: 'setItem', key, value: valueJSON});
    },

    multiSet(pairs) {
        const serialized = pairs.map((pair) => [pair[0], JSON.stringify(pair[1] === undefined ? null : pair[1])]);
        if (utils.isEmptyObject(serialized)) {
            return Promise.resolve();
        }
        return postToWorker<void>({type: 'multiSet', pairs: serialized});
    },

    multiMerge(pairs) {
        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);

        const serialized = nonNullishPairs.map(([key, value, replaceNullPatches]) => {
            const changeWithoutMarkers = JSON.stringify(value, objectMarkRemover);
            const patches = replaceNullPatches ?? [];
            const replaceQueries = patches.length > 0 ? generateJSONReplaceSQLQueries(key, patches) : undefined;

            return [key, changeWithoutMarkers, replaceQueries] as [string, string, string[][] | undefined];
        });

        return postToWorker<void>({type: 'multiMerge', pairs: serialized});
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

    /**
     * Cross-tab synchronization via BroadcastChannel.
     * When another tab's worker persists changes, it broadcasts the changed keys.
     * This tab picks them up and re-reads the values from its own cache/storage.
     */
    keepInstancesSync(onStorageKeyChanged: OnStorageKeyChanged) {
        if (syncChannel) {
            return;
        }

        syncChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        syncChannel.onmessage = (event) => {
            const {type, keys} = event.data;
            if (type !== 'keysChanged' || !Array.isArray(keys)) return;

            // For clear events, we just re-read all keys
            if (keys.includes('__clear__')) {
                provider.getAllKeys().then((allKeys) => {
                    for (const key of allKeys) {
                        provider.getItem(key).then((value) => onStorageKeyChanged(key, value));
                    }
                });
                return;
            }

            // Re-read each changed key from our worker's DB
            for (const key of keys) {
                provider.getItem(key).then((value) => onStorageKeyChanged(key, value));
            }
        };
    },
};

export default provider;
