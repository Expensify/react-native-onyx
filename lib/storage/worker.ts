/**
 * Unified Storage Web Worker
 *
 * Provider-agnostic worker that handles all database operations off the main
 * thread. On init, it receives a backend choice ('sqlite' or 'idb') and
 * dynamically imports the appropriate StorageProvider implementation.
 *
 * Messages are processed **serially** via a queue to ensure that the init
 * message completes before any data operations begin, and that concurrent
 * messages never race against each other.
 *
 * After each write operation, changed keys are broadcast to other tabs via
 * BroadcastChannel so they can update their caches.
 */

import type StorageProvider from './providers/types';
import type {StorageKeyValuePair} from './providers/types';

// ---------------------------------------------------------------------------
// Message types for main-thread <-> worker communication
// ---------------------------------------------------------------------------

type InitMessage = {type: 'init'; id: string; backend: 'sqlite' | 'idb'};
type GetItemMessage = {type: 'getItem'; id: string; key: string};
type MultiGetMessage = {type: 'multiGet'; id: string; keys: string[]};
type SetItemMessage = {type: 'setItem'; id: string; key: string; value: unknown};
type MultiSetMessage = {type: 'multiSet'; id: string; pairs: [string, unknown][]};
type MultiMergeMessage = {type: 'multiMerge'; id: string; pairs: [string, unknown, unknown[] | undefined][]};
type GetAllKeysMessage = {type: 'getAllKeys'; id: string};
type RemoveItemMessage = {type: 'removeItem'; id: string; key: string};
type RemoveItemsMessage = {type: 'removeItems'; id: string; keys: string[]};
type ClearMessage = {type: 'clear'; id: string};
type GetDatabaseSizeMessage = {type: 'getDatabaseSize'; id: string};

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
    | GetDatabaseSizeMessage;

type ResultMessage = {type: 'result'; id: string; data?: unknown; error?: string};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let provider: StorageProvider<unknown> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

const BROADCAST_CHANNEL_NAME = 'onyx-sync';

// ---------------------------------------------------------------------------
// Serial message processing queue
//
// Each incoming message is pushed into `messageQueue`. A single `processQueue`
// loop pops one message at a time, awaits its async handler, then moves to the
// next. This guarantees:
//   1. `init` completes before any data operation touches `provider`
//   2. No two messages run concurrently (avoiding IDB transaction races)
// ---------------------------------------------------------------------------

const messageQueue: WorkerMessage[] = [];
let processing = false;

async function processQueue(): Promise<void> {
    if (processing) {
        return; // another processQueue loop is already active
    }
    processing = true;

    while (messageQueue.length > 0) {
        const msg = messageQueue.shift()!;
        try {
            await handleMessage(msg);
        } catch (error) {
            sendResult(msg.id, undefined, error instanceof Error ? error.message : String(error));
        }
    }

    processing = false;
}

// ---------------------------------------------------------------------------
// Broadcasting (value-bearing messages for cross-tab sync)
// ---------------------------------------------------------------------------

/**
 * Broadcast SET operations with full values to other tabs.
 * Receiving tabs can update their caches directly without re-reading from storage.
 */
function broadcastSet(pairs: [string, unknown][]): void {
    if (broadcastChannel && pairs.length > 0) {
        broadcastChannel.postMessage({type: 'set', pairs});
    }
}

/**
 * Broadcast MERGE operations with raw patches to other tabs.
 * Receiving tabs apply fastMerge against their cached values.
 */
function broadcastMerge(pairs: [string, unknown][]): void {
    if (broadcastChannel && pairs.length > 0) {
        broadcastChannel.postMessage({type: 'merge', pairs});
    }
}

/**
 * Broadcast REMOVE operations to other tabs.
 */
function broadcastRemove(keys: string[]): void {
    if (broadcastChannel && keys.length > 0) {
        broadcastChannel.postMessage({type: 'remove', keys});
    }
}

/**
 * Broadcast CLEAR operation to other tabs.
 */
function broadcastClear(): void {
    if (broadcastChannel) {
        broadcastChannel.postMessage({type: 'clear'});
    }
}

// ---------------------------------------------------------------------------
// Result helper
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

// ---------------------------------------------------------------------------
// Message handler (processes a single message; called serially by the queue)
// ---------------------------------------------------------------------------

async function handleMessage(msg: WorkerMessage): Promise<void> {
    switch (msg.type) {
        case 'init': {
            // Dynamically import and initialize the chosen backend.
            // If SQLite WASM fails (missing WASM binary, no OPFS, etc.)
            // we automatically fall back to IndexedDB so operations never hang.
            if (msg.backend === 'sqlite') {
                try {
                    const sqliteModule = await import('./providers/SQLiteProvider/index.web');
                    const sqliteProvider = sqliteModule.default;

                    // SQLite needs async init (dynamic WASM import)
                    await sqliteModule.initAsync();
                    provider = sqliteProvider;
                } catch (sqliteError) {
                    console.warn('SQLite WASM init failed, falling back to IDB:', sqliteError);
                    const idbModule = await import('./providers/IDBKeyValProvider');
                    provider = idbModule.default;
                    provider.init();
                }
            } else {
                const idbModule = await import('./providers/IDBKeyValProvider');
                provider = idbModule.default;
                provider.init();
            }

            // Initialize BroadcastChannel for cross-tab sync
            broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            sendResult(msg.id);
            break;
        }

        case 'getItem': {
            const result = await provider!.getItem(msg.key);
            sendResult(msg.id, result);
            break;
        }

        case 'multiGet': {
            const results = await provider!.multiGet(msg.keys);
            sendResult(msg.id, results);
            break;
        }

        case 'setItem': {
            await provider!.setItem(msg.key, msg.value);
            broadcastSet([[msg.key, msg.value]]);
            sendResult(msg.id);
            break;
        }

        case 'multiSet': {
            const pairs = msg.pairs as [string, unknown][];
            await provider!.multiSet(pairs);
            broadcastSet(pairs);
            sendResult(msg.id);
            break;
        }

        case 'multiMerge': {
            const mergePairs = msg.pairs as StorageKeyValuePair[];
            await provider!.multiMerge(mergePairs);
            // Broadcast raw patches (key + change value) so receiving tabs can fastMerge
            broadcastMerge(mergePairs.map(([key, value]) => [key, value]));
            sendResult(msg.id);
            break;
        }

        case 'getAllKeys': {
            const keys = await provider!.getAllKeys();
            sendResult(msg.id, keys);
            break;
        }

        case 'removeItem': {
            await provider!.removeItem(msg.key);
            broadcastRemove([msg.key]);
            sendResult(msg.id);
            break;
        }

        case 'removeItems': {
            await provider!.removeItems(msg.keys);
            broadcastRemove(msg.keys);
            sendResult(msg.id);
            break;
        }

        case 'clear': {
            await provider!.clear();
            broadcastClear();
            sendResult(msg.id);
            break;
        }

        case 'getDatabaseSize': {
            const size = await provider!.getDatabaseSize();
            sendResult(msg.id, size);
            break;
        }

        default:
            sendResult((msg as {id: string}).id, undefined, `Unknown message type: ${(msg as {type: string}).type}`);
    }
}

// ---------------------------------------------------------------------------
// Entry point: enqueue every incoming message and kick the serial processor
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    messageQueue.push(event.data);
    processQueue();
};

export type {WorkerMessage, ResultMessage};
