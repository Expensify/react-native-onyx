import cache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import * as Logger from './Logger';
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

/**
 * Listener fired when an exact key's value changes. For collection root keys this is the
 * snapshot-mode listener: receives the frozen collection snapshot every time a member changes.
 */
type KeyListener<TKey extends OnyxKey = OnyxKey> = (value: OnyxValue<TKey>, key: TKey) => void;

/**
 * `OnyxStore` is a single listener registry for Onyx reads/subscriptions. It replaces the
 * connection manager's several per-subscription bookkeeping structures with one index:
 *
 *   keyListeners — listeners on an exact key (a single key, a collection root in snapshot
 *                  mode, or a specific collection member).
 *
 * Write paths call `notifyKey()` (single-key write) or `notifyCollection()` (batch collection
 * update from `mergeCollection`/`setCollection`/`clear`).
 *
 * NOTE: This module is introduced inert — nothing calls it yet. The subscription/notification
 * paths (`Onyx.connect`, `useOnyx`, `OnyxUtils.notify*`) are wired onto it in a later change.
 */
class OnyxStore {
    private keyListeners: Map<OnyxKey, Set<KeyListener>>;

    constructor() {
        this.keyListeners = new Map();
    }

    /**
     * Sync, cache-only read. Returns the frozen collection snapshot for collection
     * keys, the cached value for single keys, or `undefined` if not in cache.
     */
    getState<TKey extends OnyxKey>(key: TKey): OnyxValue<TKey> {
        if (OnyxKeys.isCollectionKey(key)) {
            return cache.getCollectionData(key) as OnyxValue<TKey>;
        }
        return cache.get(key) as OnyxValue<TKey>;
    }

    /**
     * Subscribe to an exact key. For collection root keys this is "snapshot mode" —
     * the listener fires with the frozen collection snapshot whenever any member
     * changes. For collection member keys or regular keys, the listener fires when
     * that specific key's value changes.
     *
     * Returns an unsubscribe function.
     */
    subscribe<TKey extends OnyxKey>(key: TKey, listener: KeyListener<TKey>): () => void {
        let listeners = this.keyListeners.get(key);
        if (!listeners) {
            listeners = new Set();
            this.keyListeners.set(key, listeners);
        }
        listeners.add(listener as unknown as KeyListener);
        return () => {
            const set = this.keyListeners.get(key);
            if (!set) {
                return;
            }
            set.delete(listener as unknown as KeyListener);
            if (set.size === 0) {
                this.keyListeners.delete(key);
            }
        };
    }

    /**
     * Notify of a single-key write.
     *
     * Dispatch:
     *   1. keyListeners.get(key) — exact-key subscribers (always fires)
     *   2. If key is a collection member: keyListeners.get(collectionKey) — snapshot
     *      subscribers for the parent collection (unless suppressed).
     *
     * `options.suppressCollectionSnapshot` skips step 2 — used by collection-batch
     * write paths so each member-write doesn't re-trigger the collection-level
     * snapshot listeners; the outer `notifyCollection()` fires those once.
     */
    notifyKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, options?: {suppressCollectionSnapshot?: boolean}): void {
        // 1. Exact-key listeners
        const exact = this.keyListeners.get(key);
        if (exact && exact.size > 0) {
            for (const listener of exact) {
                this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, key), key);
            }
        }

        // 2. Collection-level snapshot routing — only fires when the write is to a member key.
        // Direct writes to a collection root (e.g. `Onyx.merge(COLLECTION_KEY, ...)`) are
        // an unsupported anti-pattern — treat them as opaque single-key writes.
        const collectionKey = OnyxKeys.getCollectionKey(key);
        const isCollectionMemberWrite = collectionKey !== undefined && collectionKey !== key;
        if (isCollectionMemberWrite && !options?.suppressCollectionSnapshot) {
            const snapshotListeners = this.keyListeners.get(collectionKey);
            if (snapshotListeners && snapshotListeners.size > 0) {
                const snapshot = cache.getCollectionData(collectionKey);
                for (const listener of snapshotListeners) {
                    this.safeInvoke(() => listener(snapshot as OnyxValue<OnyxKey>, collectionKey), collectionKey);
                }
            }
        }
    }

    /**
     * Notify of a collection-level batch update. Used by `mergeCollection`,
     * `setCollection`, and `clear`'s collection path.
     *
     * Dispatch:
     *   1. keyListeners.get(collectionKey) — fires ONCE with the new snapshot.
     *   2. keyListeners.get(memberKey) — fires per changed member where the value
     *      differs from the previous (for ref-equality on unchanged members).
     */
    notifyCollection<TKey extends CollectionKeyBase>(
        collectionKey: TKey,
        partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
        partialPreviousCollection?: OnyxCollection<KeyValueMapping[TKey]>,
    ): void {
        const changedKeys = Object.keys(partialCollection ?? {});
        if (changedKeys.length === 0) {
            return;
        }
        const previous = partialPreviousCollection ?? {};

        // Read the merged snapshot once. `cache.getCollectionData()` returns the post-merge
        // frozen object, which is what listeners should see (not the raw `partialCollection`
        // input, which is just the delta and lacks fields preserved during merge).
        const snapshot = cache.getCollectionData(collectionKey);

        // 1. Snapshot subscribers fire once with the new snapshot.
        const snapshotListeners = this.keyListeners.get(collectionKey);
        if (snapshotListeners && snapshotListeners.size > 0) {
            for (const listener of snapshotListeners) {
                this.safeInvoke(() => listener(snapshot as OnyxValue<OnyxKey>, collectionKey), collectionKey);
            }
        }

        // 2. Exact-member subscribers fire per changed key (skip if ref unchanged vs previous).
        for (const memberKey of changedKeys) {
            const value = snapshot?.[memberKey];
            const prev = previous[memberKey];
            if (value === prev) {
                continue;
            }
            const exact = this.keyListeners.get(memberKey);
            if (!exact || exact.size === 0) {
                continue;
            }
            for (const listener of exact) {
                this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, memberKey), memberKey);
            }
        }
    }

    /** Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on. */
    clearAll(): void {
        this.keyListeners.clear();
    }

    /** True if there are any subscribers for the given key (exact or parent collection). */
    hasListenersForKey(key: OnyxKey): boolean {
        if ((this.keyListeners.get(key)?.size ?? 0) > 0) {
            return true;
        }
        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey && collectionKey !== key && (this.keyListeners.get(collectionKey)?.size ?? 0) > 0) {
            return true;
        }
        return false;
    }

    private safeInvoke(fn: () => void, contextKey: OnyxKey): void {
        try {
            fn();
        } catch (error) {
            Logger.logAlert(`[OnyxStore] Listener threw an error for key '${contextKey}': ${error}`);
        }
    }
}

const onyxStore = new OnyxStore();

export default onyxStore;
export type {KeyListener};
