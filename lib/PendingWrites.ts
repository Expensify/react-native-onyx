import OnyxKeys from './OnyxKeys';
import type {OnyxKey} from './types';

// In-flight writes tracked per affected key, so a subscriber's initial notification waits only for
// writes that can change its own value, never for unrelated (or slow) writes elsewhere.
const pendingWritesByKey = new Map<OnyxKey, Set<Promise<unknown>>>();

// In-flight writes that affect every key (Onyx.clear). Any initial notification waits for these.
const pendingGlobalWrites = new Set<Promise<unknown>>();

/**
 * Registers an in-flight write under each key it can change, so `scheduleInitialSubscriberNotification`
 * waits only for the writes relevant to a connecting key. Returns the same promise so callers can wrap a
 * write's return value inline. The write is deregistered once it settles (success or failure).
 */
function trackPendingWrite<T>(keys: OnyxKey | OnyxKey[], pendingWrite: Promise<T>): Promise<T> {
    // Drop nullish keys (e.g. a keyless `clear` item) so they never reach `getPendingWritesForKey`'s scan.
    const keyList = (Array.isArray(keys) ? keys : [keys]).filter((key) => typeof key === 'string');
    for (const key of keyList) {
        let pendingWritesForKey = pendingWritesByKey.get(key);
        if (!pendingWritesForKey) {
            pendingWritesForKey = new Set();
            pendingWritesByKey.set(key, pendingWritesForKey);
        }
        pendingWritesForKey.add(pendingWrite);
    }
    const deregister = () => {
        for (const key of keyList) {
            const pendingWritesForKey = pendingWritesByKey.get(key);
            if (!pendingWritesForKey) {
                continue;
            }
            pendingWritesForKey.delete(pendingWrite);
            if (pendingWritesForKey.size === 0) {
                pendingWritesByKey.delete(key);
            }
        }
    };
    pendingWrite.then(deregister, deregister);
    return pendingWrite;
}

/**
 * Registers an in-flight write that affects every key (Onyx.clear). Deregistered once it settles.
 */
function trackPendingGlobalWrite<T>(pendingGlobalWrite: Promise<T>): Promise<T> {
    pendingGlobalWrites.add(pendingGlobalWrite);
    const deregister = () => pendingGlobalWrites.delete(pendingGlobalWrite);
    pendingGlobalWrite.then(deregister, deregister);
    return pendingGlobalWrite;
}

/**
 * In-flight writes that can change the value delivered to a subscriber of `key`: writes to the key
 * itself, writes to any member when `key` is a collection root, and global writes (clear).
 */
function getPendingWritesForKey(key: OnyxKey): Array<Promise<unknown>> {
    const promises = [...pendingGlobalWrites];
    const own = pendingWritesByKey.get(key);
    if (own) {
        promises.push(...own);
    }
    if (OnyxKeys.isCollectionKey(key)) {
        for (const [writeKey, pendingWritesForKey] of pendingWritesByKey) {
            // Membership resolves by longest match, as `notifyKey`/`notifyCollection` do, so a write to a
            // more specific collection (`test_level_last_1`) is not treated as a member of a shorter one
            // (`test_level_`) and cannot delay its subscribers.
            if (writeKey !== key && OnyxKeys.getCollectionKey(writeKey) === key) {
                promises.push(...pendingWritesForKey);
            }
        }
    }
    return promises;
}

/**
 * Defer a subscriber's initial notification until the writes relevant to `key` that are in flight this
 * tick have applied, so it reads post-write cache and dedups against their notifications. The wait is
 * scoped to `key` and snapshotted after one microtask, so an unrelated or slow write elsewhere cannot
 * block or postpone this delivery, and writes issued after it do not either.
 */
function scheduleInitialSubscriberNotification(key: OnyxKey, notify: () => void): void {
    Promise.resolve().then(() => {
        const relevant = getPendingWritesForKey(key);
        if (relevant.length === 0) {
            notify();
            return;
        }
        Promise.all(relevant.map((pendingWrite) => pendingWrite.catch(() => undefined))).then(notify);
    });
}

/**
 * Drop all tracked writes, useful in test environments.
 */
function clearPendingWrites(): void {
    pendingWritesByKey.clear();
    pendingGlobalWrites.clear();
}

export default {
    trackPendingWrite,
    trackPendingGlobalWrite,
    getPendingWritesForKey,
    scheduleInitialSubscriberNotification,
    clearPendingWrites,
};
