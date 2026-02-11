/**
 * WriteBuffer implements a patch-staging layer for storage operations.
 *
 * It tracks two types of pending entries:
 * - SET entries: full values from set()/multiSet(), flushed via multiSet
 * - MERGE entries: accumulated patch deltas from merge operations, flushed via
 *   multiMerge (preserving JSON_PATCH efficiency on SQLite)
 *
 * Multiple writes to the same key are coalesced: successive sets replace the
 * value, successive merges accumulate patches, and a set after a merge discards
 * the pending patch. A merge after a set applies the patch to the full value
 * in-memory (unavoidable since the set hasn't been persisted yet).
 *
 * The backing data structure is pluggable via the `BufferStore` interface:
 * - Web: JS `Map` (BufferStore/index.ts)
 * - Native: NitroModules HybridObject with shared C++ memory
 *   (BufferStore/index.native.ts)
 *
 * Flush scheduling is also pluggable. On web, `requestIdleCallback` is used.
 * On native, the background C++ thread handles flushing, so the scheduler is
 * a no-op.
 */

import type {OnyxKey, OnyxValue} from '../types';
import type {FastMergeReplaceNullPatch} from '../utils';
import utils from '../utils';
import type {StorageKeyValuePair} from './providers/types';
import type BufferStore from './BufferStore/types';

type EntryType = 'set' | 'merge';

type BufferEntry = {
    key: OnyxKey;
    value: OnyxValue<OnyxKey>;
    entryType: EntryType;
    replaceNullPatches?: FastMergeReplaceNullPatch[];
};

/** Flush handlers for the two entry types. */
type FlushHandlers = {
    multiSet: (pairs: StorageKeyValuePair[]) => Promise<void>;
    multiMerge: (pairs: StorageKeyValuePair[]) => Promise<void>;
};

/**
 * A function that schedules a flush. The implementation is platform-specific:
 * - Web: schedules via requestIdleCallback with a timeout
 * - Native: no-op (the native BufferStore's background thread handles it)
 *
 * Returns a handle that can be passed to `cancelFlush`, or null if no
 * cancellation is needed.
 */
type FlushScheduler = (doFlush: () => void) => number | null;

/**
 * A function that cancels a previously scheduled flush.
 */
type CancelFlush = (handle: number) => void;

/**
 * Maximum delay before a scheduled flush is forced, in milliseconds.
 *
 * Under normal conditions, requestIdleCallback fires during the next idle
 * period (often within a few ms). This timeout is a safety net: if the
 * browser stays busy for longer than FLUSH_TIMEOUT_MS, the flush is forced.
 *
 * 200ms lets typical write bursts (10-50ms) fully coalesce before flushing,
 * while still being well under perceptible delay. The WriteBuffer's
 * read-through ensures in-memory consistency regardless of flush timing.
 */
const FLUSH_TIMEOUT_MS = 200;

/** Default web flush scheduler using requestIdleCallback with setTimeout fallback. */
function defaultScheduleFlush(doFlush: () => void): number | null {
    if (typeof requestIdleCallback === 'function') {
        return requestIdleCallback(doFlush, {timeout: FLUSH_TIMEOUT_MS}) as unknown as number;
    }
    return setTimeout(doFlush, FLUSH_TIMEOUT_MS) as unknown as number;
}

/** Default web cancel flush using cancelIdleCallback with clearTimeout fallback. */
function defaultCancelFlush(handle: number): void {
    if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(handle);
    } else {
        clearTimeout(handle);
    }
}

type WriteBufferConfig = {
    handlers: FlushHandlers;
    store: BufferStore;
    scheduleFlush?: FlushScheduler;
    cancelFlush?: CancelFlush;
};

class WriteBuffer {
    /** The pluggable backing store for pending buffer entries. */
    private store: BufferStore;

    /** Handle returned by the scheduled flush, used for cancellation. */
    private flushHandle: number | null = null;

    /** Whether a flush is currently in progress. */
    private isFlushing = false;

    /** The handlers called on flush for each entry type. */
    private readonly handlers: FlushHandlers;

    /** Platform-specific flush scheduler. */
    private readonly scheduleFlushFn: FlushScheduler;

    /** Platform-specific flush cancellation. */
    private readonly cancelFlushFn: CancelFlush;

    constructor(config: WriteBufferConfig) {
        this.handlers = config.handlers;
        this.store = config.store;
        this.scheduleFlushFn = config.scheduleFlush ?? defaultScheduleFlush;
        this.cancelFlushFn = config.cancelFlush ?? defaultCancelFlush;
    }

    /**
     * Stage a full value for a key (SET entry). If the key had a pending MERGE,
     * the set replaces it entirely. A flush is scheduled if not already pending.
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): void {
        this.store.set(key, {key, value, entryType: 'set'});
        this.scheduleFlush();
    }

    /**
     * Stage full values for multiple keys (all as SET entries).
     */
    setMany(pairs: StorageKeyValuePair[]): void {
        for (const [key, value] of pairs) {
            this.store.set(key, {key, value, entryType: 'set'});
        }
        this.scheduleFlush();
    }

    /**
     * Stage a merge patch for a key (MERGE entry). Interaction with existing entries:
     * - No existing entry: create a MERGE entry with just the patch
     * - Existing SET entry: apply patch to the full value in-memory, keep as SET
     * - Existing MERGE entry: merge patches together, keep as MERGE
     */
    merge(key: OnyxKey, patch: OnyxValue<OnyxKey>, replaceNullPatches?: FastMergeReplaceNullPatch[]): void {
        const existing = this.store.get(key);

        if (!existing) {
            // No pending write -- stage as a MERGE entry (just the patch)
            this.store.set(key, {key, value: patch, entryType: 'merge', replaceNullPatches});
        } else if (existing.entryType === 'set') {
            // Pending SET -- apply patch to the full value, stay as SET
            const {result: merged} = utils.fastMerge(existing.value as Record<string, unknown>, patch as Record<string, unknown>, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            });
            this.store.set(key, {key, value: merged as OnyxValue<OnyxKey>, entryType: 'set'});
        } else {
            // Pending MERGE -- merge patches together, stay as MERGE
            const {result: mergedPatch} = utils.fastMerge(existing.value as Record<string, unknown>, patch as Record<string, unknown>, {
                shouldRemoveNestedNulls: false, // preserve nulls -- provider handles them
            });
            const combinedPatches = [...(existing.replaceNullPatches ?? []), ...(replaceNullPatches ?? [])];
            this.store.set(key, {
                key,
                value: mergedPatch as OnyxValue<OnyxKey>,
                entryType: 'merge',
                replaceNullPatches: combinedPatches.length > 0 ? combinedPatches : undefined,
            });
        }

        this.scheduleFlush();
    }

    /**
     * Remove a key from the write buffer. This is used when a key is being
     * removed from storage entirely (not just set to null).
     */
    remove(key: OnyxKey): void {
        this.store.delete(key);
    }

    /**
     * Remove multiple keys from the write buffer.
     */
    removeMany(keys: OnyxKey[]): void {
        for (const key of keys) {
            this.store.delete(key);
        }
    }

    /**
     * Read-through for SET entries only. Returns the pending full value if the
     * key has a SET entry, or undefined otherwise. MERGE entries are not served
     * because they contain only a patch, not a complete value -- the caller
     * should fall through to the provider for those.
     */
    get(key: OnyxKey): OnyxValue<OnyxKey> | undefined {
        const entry = this.store.get(key);
        if (entry?.entryType === 'set') {
            return entry.value;
        }
        return undefined;
    }

    /**
     * Check whether the given key has a pending SET entry (suitable for
     * read-through). Returns false for MERGE entries since those only
     * contain a patch, not a complete value.
     */
    has(key: OnyxKey): boolean {
        const entry = this.store.get(key);
        return entry?.entryType === 'set';
    }

    /**
     * Check whether the key has any pending entry (SET or MERGE).
     */
    hasAny(key: OnyxKey): boolean {
        return this.store.has(key);
    }

    /**
     * Returns the number of pending entries (both SET and MERGE).
     */
    get size(): number {
        return this.store.size;
    }

    /**
     * Clear all pending entries and cancel any scheduled flush.
     */
    clear(): void {
        this.store.clear();
        this.cancelScheduledFlush();
    }

    /**
     * Immediately flush all pending entries to the storage provider.
     *
     * SET entries use reference identity: they stay in the map during flush and
     * are only removed afterward if their reference hasn't changed (handling
     * concurrent set-during-flush correctly).
     *
     * MERGE entries are removed from the map at flush start. New merges during
     * flush create fresh entries, avoiding double-application of patches.
     */
    async flushNow(): Promise<void> {
        if (this.isFlushing) {
            // Wait for the current flush to finish, then flush again
            return new Promise<void>((resolve) => {
                const waitForFlush = () => {
                    if (!this.isFlushing) {
                        resolve(this.flushNow());
                        return;
                    }
                    setTimeout(waitForFlush, 5);
                };
                waitForFlush();
            });
        }

        this.cancelScheduledFlush();

        if (this.store.size === 0) {
            return;
        }

        this.isFlushing = true;
        try {
            // Separate entries by type
            const setPairs: StorageKeyValuePair[] = [];
            const setSnapshot: Map<OnyxKey, BufferEntry> = new Map();
            const mergePairs: StorageKeyValuePair[] = [];
            const mergeKeys: OnyxKey[] = [];

            for (const [key, entry] of this.store.entries()) {
                if (entry.entryType === 'set') {
                    setPairs.push([entry.key, entry.value]);
                    setSnapshot.set(key, entry);
                } else {
                    mergePairs.push([entry.key, entry.value, entry.replaceNullPatches]);
                    mergeKeys.push(key);
                }
            }

            // Remove MERGE entries from the map at flush start.
            // New merges during flush will create fresh entries.
            for (const key of mergeKeys) {
                this.store.delete(key);
            }

            // Flush both types concurrently
            const promises: Array<Promise<void>> = [];
            if (setPairs.length > 0) {
                promises.push(this.handlers.multiSet(setPairs));
            }
            if (mergePairs.length > 0) {
                promises.push(this.handlers.multiMerge(mergePairs));
            }

            await Promise.all(promises);

            // For SET entries: only remove if the reference hasn't changed
            // (i.e., no set or merge was applied to this key during flush)
            for (const [key, flushedEntry] of setSnapshot) {
                if (this.store.get(key) === flushedEntry) {
                    this.store.delete(key);
                }
            }
        } finally {
            this.isFlushing = false;
        }

        // If new entries were added during flush, schedule another one
        if (this.store.size > 0) {
            this.scheduleFlush();
        }
    }

    /**
     * Schedule a flush using the platform-specific scheduler.
     * If a flush is already scheduled, this is a no-op.
     */
    private scheduleFlush(): void {
        if (this.flushHandle !== null) {
            return;
        }

        this.flushHandle = this.scheduleFlushFn(() => {
            this.flushHandle = null;
            void this.flushNow();
        });
    }

    /**
     * Cancel any pending scheduled flush.
     */
    private cancelScheduledFlush(): void {
        if (this.flushHandle === null) {
            return;
        }

        this.cancelFlushFn(this.flushHandle);
        this.flushHandle = null;
    }
}

export default WriteBuffer;
export type {FlushHandlers, BufferEntry, EntryType, FlushScheduler, CancelFlush, WriteBufferConfig};
