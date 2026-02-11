/**
 * NativeFlushWorker -- Manages the Worklet Worker Runtime for native persistence.
 *
 * Creates a background JS thread using react-native-worklets-core's context API.
 * The flush worklet periodically:
 * 1. Calls bufferStore.drain() on the shared HybridObject (shared memory, no postMessage)
 * 2. JSON.stringifies the drained entries (on the worker thread, not main thread)
 * 3. Calls react-native-nitro-sqlite sync APIs to persist to SQLite
 *
 * The main thread only pays the cost of AnyMap conversion (via Nitro's fromJSI)
 * when populating the buffer. All serialization and I/O happens on the worker.
 *
 * Architecture symmetry: This is the native analog of the web's worker.ts +
 * WorkerStorageProvider, but uses shared memory instead of postMessage.
 */

import type {IWorkletContext, IWorkletNativeApi} from 'react-native-worklets-core';
import type {BufferEntry} from './WriteBuffer';
import type BufferStore from './BufferStore/types';

/**
 * Flush interval in milliseconds. The worker thread wakes up at this
 * cadence to drain and persist any buffered writes.
 */
const FLUSH_INTERVAL_MS = 200;

/**
 * Creates and starts the native flush worker.
 *
 * Uses react-native-worklets-core to create a dedicated background context
 * ("OnyxFlushWorker") that runs flush worklets. The SQLite provider and
 * buffer store are injected into the context as decorators so they're
 * accessible inside worklets without closure capturing.
 *
 * @param bufferStore - The HybridObject-backed BufferStore shared with the main thread
 * @returns Object with start(), stop(), flushNow(), and getProvider()
 */
function createNativeFlushWorker(bufferStore: BufferStore) {
    let flushInterval: ReturnType<typeof setInterval> | null = null;
    let isRunning = false;
    let workerContext: IWorkletContext | null = null;

    // Import the native SQLite provider lazily to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nativeSQLiteProvider = require('./providers/SQLiteProvider/index.native').default;

    /**
     * Perform a single flush cycle: drain the buffer and persist to SQLite.
     *
     * This is called from the Worklet context (background thread). The
     * bufferStore.drain() operation is a shared-memory read (no postMessage),
     * and JSON.stringify + SQLite execute happen entirely off the main thread.
     */
    function flush(): void {
        if (bufferStore.size === 0) {
            return;
        }

        // Drain all entries from the shared buffer atomically
        const entries = Array.from(bufferStore.entries());
        bufferStore.clear();

        if (entries.length === 0) {
            return;
        }

        // Separate SET and MERGE entries for the provider
        const setPairs: [string, unknown][] = [];
        const mergePairs: [string, unknown, unknown][] = [];

        for (const [, entry] of entries) {
            const typedEntry = entry as BufferEntry;
            if (typedEntry.entryType === 'set') {
                setPairs.push([typedEntry.key, typedEntry.value]);
            } else {
                mergePairs.push([typedEntry.key, typedEntry.value, typedEntry.replaceNullPatches]);
            }
        }

        // Persist to SQLite using sync APIs (on the worker thread)
        try {
            if (setPairs.length > 0) {
                nativeSQLiteProvider.multiSet(setPairs);
            }
            if (mergePairs.length > 0) {
                nativeSQLiteProvider.multiMerge(mergePairs);
            }
        } catch (error) {
            console.error('[Onyx] NativeFlushWorker: flush error:', error);
        }
    }

    /**
     * Schedule periodic flush on the Worklet context.
     * The main thread triggers a runAsync on the worker context at FLUSH_INTERVAL_MS
     * cadence. The actual drain + serialize + persist all execute on the worker thread.
     */
    function schedulePeriodicFlush(): void {
        if (flushInterval !== null) {
            return;
        }

        if (workerContext) {
            // Use the Worklet context to run flush on the background thread.
            // createRunAsync memoizes the worklet so repeated calls are efficient.
            const runFlush = workerContext.createRunAsync(flush);
            flushInterval = setInterval(() => {
                runFlush().catch((error) => {
                    console.error('[Onyx] NativeFlushWorker: scheduled flush error:', error);
                });
            }, FLUSH_INTERVAL_MS);
        } else {
            // Fallback: no Worklet context available (e.g., test environment).
            // Run flush directly on the main thread.
            flushInterval = setInterval(flush, FLUSH_INTERVAL_MS);
        }
    }

    return {
        /**
         * Start the flush worker. Initializes the SQLite provider, creates
         * the Worklet context, and begins periodic flushing.
         */
        start(): void {
            if (isRunning) {
                return;
            }

            // Initialize the native SQLite provider
            nativeSQLiteProvider.init();

            // Create the Worklet context for background flush
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const {Worklets} = require('react-native-worklets-core') as {Worklets: IWorkletNativeApi};
                workerContext = Worklets.createContext('OnyxFlushWorker');
            } catch {
                console.warn('[Onyx] react-native-worklets-core not available, flush will run on main thread');
                workerContext = null;
            }

            isRunning = true;
            schedulePeriodicFlush();
        },

        /**
         * Stop the flush worker and perform a final flush to ensure all
         * pending writes are persisted.
         */
        stop(): void {
            if (!isRunning) {
                return;
            }

            isRunning = false;
            if (flushInterval !== null) {
                clearInterval(flushInterval);
                flushInterval = null;
            }

            // Final flush to persist any remaining entries
            flush();
        },

        /**
         * Force an immediate flush (e.g., on app background/shutdown).
         */
        flushNow(): void {
            flush();
        },

        /**
         * Get the underlying SQLite provider for read operations.
         * Read operations go directly to the provider, bypassing the buffer.
         */
        getProvider() {
            return nativeSQLiteProvider;
        },
    };
}

export default createNativeFlushWorker;
export type NativeFlushWorker = ReturnType<typeof createNativeFlushWorker>;
