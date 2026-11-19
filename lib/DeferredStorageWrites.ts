import * as Logger from './Logger';
import type {OnyxKey} from './types';

// A deferred key is persisted once writes to it pause for this long, so a burst of sets costs one storage write.
const DEFERRED_WRITE_DELAY_MS = 1000;

// A key that keeps changing is still persisted at least this often, so storage never falls far behind the cache.
const DEFERRED_WRITE_MAX_DELAY_MS = 5000;

type PendingDeferredWrite = {
    timer: ReturnType<typeof setTimeout>;
    firstScheduledAt: number;
    write: () => Promise<void>;
};

const pendingDeferredWrites = new Map<OnyxKey, PendingDeferredWrite>();

/**
 * Runs and forgets the pending write of `key`.
 */
function runPendingWrite(key: OnyxKey): Promise<void> {
    const pendingWrite = pendingDeferredWrites.get(key);
    if (!pendingWrite) {
        return Promise.resolve();
    }
    clearTimeout(pendingWrite.timer);
    pendingDeferredWrites.delete(key);
    return pendingWrite.write();
}

/**
 * Schedules `write` to persist `key` once writes to it pause, replacing any write already scheduled for that key.
 * The write runs when storage is updated, so it should read the value to store at that moment rather than capture it.
 */
function schedule(key: OnyxKey, write: () => Promise<void>): void {
    const now = Date.now();
    const existingWrite = pendingDeferredWrites.get(key);
    const firstScheduledAt = existingWrite?.firstScheduledAt ?? now;
    if (existingWrite) {
        clearTimeout(existingWrite.timer);
    }
    const delay = Math.max(0, Math.min(DEFERRED_WRITE_DELAY_MS, firstScheduledAt + DEFERRED_WRITE_MAX_DELAY_MS - now));
    const timer = setTimeout(() => {
        runPendingWrite(key).catch((error: Error) => {
            Logger.logAlert(`Deferred storage write threw. key: ${key}. message: ${error?.message}`);
        });
    }, delay);
    pendingDeferredWrites.set(key, {timer, firstScheduledAt, write});
}

/**
 * Drops the pending write of `key`, for when another write makes it obsolete.
 */
function cancel(key: OnyxKey): void {
    const pendingWrite = pendingDeferredWrites.get(key);
    if (!pendingWrite) {
        return;
    }
    clearTimeout(pendingWrite.timer);
    pendingDeferredWrites.delete(key);
}

/**
 * Drops every pending write except those of keys matched by `shouldKeep`.
 */
function cancelAll(shouldKeep: (key: OnyxKey) => boolean = () => false): void {
    for (const key of [...pendingDeferredWrites.keys()]) {
        if (!shouldKeep(key)) {
            cancel(key);
        }
    }
}

function hasPendingWrite(key: OnyxKey): boolean {
    return pendingDeferredWrites.has(key);
}

export default {
    DEFERRED_WRITE_DELAY_MS,
    DEFERRED_WRITE_MAX_DELAY_MS,
    schedule,
    cancel,
    cancelAll,
    hasPendingWrite,
};
