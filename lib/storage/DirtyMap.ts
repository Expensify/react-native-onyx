/**
 * DirtyMap implements a patch-staging layer for storage operations.
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
 * Flush is scheduled via requestIdleCallback (with a 50ms timeout fallback) to
 * keep the main thread responsive while persisting data promptly.
 */

import type {OnyxKey, OnyxValue} from '../types';
import type {FastMergeReplaceNullPatch} from '../utils';
import utils from '../utils';
import type {StorageKeyValuePair} from './providers/types';

type EntryType = 'set' | 'merge';

type DirtyEntry = {
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

/** Default idle-callback timeout in milliseconds. */
const FLUSH_TIMEOUT_MS = 50;

class DirtyMap {
    /** Map of pending dirty entries keyed by OnyxKey. */
    private dirtyEntries: Map<OnyxKey, DirtyEntry> = new Map();

    /** Handle returned by the scheduled flush, used for cancellation. */
    private flushHandle: number | null = null;

    /** Whether a flush is currently in progress. */
    private isFlushing = false;

    /** The handlers called on flush for each entry type. */
    private readonly handlers: FlushHandlers;

    constructor(handlers: FlushHandlers) {
        this.handlers = handlers;
    }

    /**
     * Stage a full value for a key (SET entry). If the key had a pending MERGE,
     * the set replaces it entirely. A flush is scheduled if not already pending.
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): void {
        this.dirtyEntries.set(key, {key, value, entryType: 'set'});
        this.scheduleFlush();
    }

    /**
     * Stage full values for multiple keys (all as SET entries).
     */
    setMany(pairs: StorageKeyValuePair[]): void {
        for (const [key, value] of pairs) {
            this.dirtyEntries.set(key, {key, value, entryType: 'set'});
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
        const existing = this.dirtyEntries.get(key);

        if (!existing) {
            // No pending write -- stage as a MERGE entry (just the patch)
            this.dirtyEntries.set(key, {key, value: patch, entryType: 'merge', replaceNullPatches});
        } else if (existing.entryType === 'set') {
            // Pending SET -- apply patch to the full value, stay as SET
            const {result: merged} = utils.fastMerge(existing.value as Record<string, unknown>, patch as Record<string, unknown>, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            });
            this.dirtyEntries.set(key, {key, value: merged as OnyxValue<OnyxKey>, entryType: 'set'});
        } else {
            // Pending MERGE -- merge patches together, stay as MERGE
            const {result: mergedPatch} = utils.fastMerge(existing.value as Record<string, unknown>, patch as Record<string, unknown>, {
                shouldRemoveNestedNulls: false, // preserve nulls -- provider handles them
            });
            const combinedPatches = [...(existing.replaceNullPatches ?? []), ...(replaceNullPatches ?? [])];
            this.dirtyEntries.set(key, {
                key,
                value: mergedPatch as OnyxValue<OnyxKey>,
                entryType: 'merge',
                replaceNullPatches: combinedPatches.length > 0 ? combinedPatches : undefined,
            });
        }

        this.scheduleFlush();
    }

    /**
     * Remove a key from the dirty map. This is used when a key is being
     * removed from storage entirely (not just set to null).
     */
    remove(key: OnyxKey): void {
        this.dirtyEntries.delete(key);
    }

    /**
     * Remove multiple keys from the dirty map.
     */
    removeMany(keys: OnyxKey[]): void {
        for (const key of keys) {
            this.dirtyEntries.delete(key);
        }
    }

    /**
     * Read-through for SET entries only. Returns the pending full value if the
     * key has a SET entry, or undefined otherwise. MERGE entries are not served
     * because they contain only a patch, not a complete value -- the caller
     * should fall through to the provider for those.
     */
    get(key: OnyxKey): OnyxValue<OnyxKey> | undefined {
        const entry = this.dirtyEntries.get(key);
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
        const entry = this.dirtyEntries.get(key);
        return entry?.entryType === 'set';
    }

    /**
     * Check whether the key has any pending entry (SET or MERGE).
     */
    hasAny(key: OnyxKey): boolean {
        return this.dirtyEntries.has(key);
    }

    /**
     * Returns the number of pending dirty entries (both SET and MERGE).
     */
    get size(): number {
        return this.dirtyEntries.size;
    }

    /**
     * Clear all pending dirty entries and cancel any scheduled flush.
     */
    clear(): void {
        this.dirtyEntries.clear();
        this.cancelScheduledFlush();
    }

    /**
     * Immediately flush all pending dirty entries to the storage provider.
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

        if (this.dirtyEntries.size === 0) {
            return;
        }

        this.isFlushing = true;
        try {
            // Separate entries by type
            const setPairs: StorageKeyValuePair[] = [];
            const setSnapshot: Map<OnyxKey, DirtyEntry> = new Map();
            const mergePairs: StorageKeyValuePair[] = [];
            const mergeKeys: OnyxKey[] = [];

            for (const [key, entry] of this.dirtyEntries) {
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
                this.dirtyEntries.delete(key);
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
                if (this.dirtyEntries.get(key) === flushedEntry) {
                    this.dirtyEntries.delete(key);
                }
            }
        } finally {
            this.isFlushing = false;
        }

        // If new entries were added during flush, schedule another one
        if (this.dirtyEntries.size > 0) {
            this.scheduleFlush();
        }
    }

    /**
     * Schedule a flush using requestIdleCallback (with fallback to setTimeout).
     * If a flush is already scheduled, this is a no-op.
     */
    private scheduleFlush(): void {
        if (this.flushHandle !== null) {
            return;
        }

        if (typeof requestIdleCallback === 'function') {
            this.flushHandle = requestIdleCallback(
                () => {
                    this.flushHandle = null;
                    void this.flushNow();
                },
                {timeout: FLUSH_TIMEOUT_MS},
            ) as unknown as number;
        } else {
            this.flushHandle = setTimeout(() => {
                this.flushHandle = null;
                void this.flushNow();
            }, FLUSH_TIMEOUT_MS) as unknown as number;
        }
    }

    /**
     * Cancel any pending scheduled flush.
     */
    private cancelScheduledFlush(): void {
        if (this.flushHandle === null) {
            return;
        }

        if (typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(this.flushHandle);
        } else {
            clearTimeout(this.flushHandle);
        }
        this.flushHandle = null;
    }
}

export default DirtyMap;
export type {FlushHandlers, DirtyEntry, EntryType};
