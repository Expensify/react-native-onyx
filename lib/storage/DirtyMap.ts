/**
 * DirtyMap implements write coalescing for storage operations.
 *
 * Instead of flushing every individual write to the storage provider immediately,
 * DirtyMap tracks the latest value for each modified key and batches them into a
 * single multiSet call on flush. This reduces the number of storage transactions
 * and avoids persisting intermediate values when the same key is written multiple
 * times in quick succession.
 *
 * Flush is scheduled via requestIdleCallback (with a 50ms timeout fallback) to
 * allow the main thread to remain responsive while still persisting data promptly.
 */

import type {OnyxKey, OnyxValue} from '../types';
import type {StorageKeyValuePair} from './providers/types';

type DirtyEntry = {
    key: OnyxKey;
    value: OnyxValue<OnyxKey>;
};

/** Flush callback that receives the coalesced batch of key-value pairs. */
type FlushHandler = (pairs: StorageKeyValuePair[]) => Promise<void>;

/** Default idle-callback timeout in milliseconds. */
const FLUSH_TIMEOUT_MS = 50;

class DirtyMap {
    /** Map of pending dirty entries keyed by OnyxKey. Only the latest value per key is kept. */
    private dirtyEntries: Map<OnyxKey, DirtyEntry> = new Map();

    /** Handle returned by the scheduled flush, used for cancellation. */
    private flushHandle: number | null = null;

    /** Whether a flush is currently in progress. */
    private isFlushing = false;

    /** The handler called on flush with the coalesced batch. */
    private readonly onFlush: FlushHandler;

    constructor(onFlush: FlushHandler) {
        this.onFlush = onFlush;
    }

    /**
     * Mark a key as dirty with the given value. If the key was already dirty,
     * its value is replaced (coalesced). A flush is scheduled if not already pending.
     */
    set(key: OnyxKey, value: OnyxValue<OnyxKey>): void {
        this.dirtyEntries.set(key, {key, value});
        this.scheduleFlush();
    }

    /**
     * Mark multiple keys as dirty.
     */
    setMany(pairs: StorageKeyValuePair[]): void {
        for (const [key, value] of pairs) {
            this.dirtyEntries.set(key, {key, value});
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
     * Read-through: if the key is in the dirty map, return its pending value.
     * Returns undefined if the key is not dirty (caller should read from provider).
     */
    get(key: OnyxKey): OnyxValue<OnyxKey> | undefined {
        const entry = this.dirtyEntries.get(key);
        return entry?.value;
    }

    /**
     * Check whether the given key has a pending dirty write.
     */
    has(key: OnyxKey): boolean {
        return this.dirtyEntries.has(key);
    }

    /**
     * Returns the number of pending dirty entries.
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
     * Returns a promise that resolves when the flush handler completes.
     * If there are no dirty entries, resolves immediately.
     * If a flush is already in progress, waits for it to finish, then flushes again
     * to capture any entries that were added during the previous flush.
     */
    async flushNow(): Promise<void> {
        if (this.isFlushing) {
            // Wait for the current flush to finish, then flush again
            // to capture any entries added during the previous flush.
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
            // Snapshot and clear the current dirty entries atomically
            const pairs: StorageKeyValuePair[] = [];
            for (const entry of this.dirtyEntries.values()) {
                pairs.push([entry.key, entry.value]);
            }
            this.dirtyEntries.clear();

            await this.onFlush(pairs);
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
export type {FlushHandler};
